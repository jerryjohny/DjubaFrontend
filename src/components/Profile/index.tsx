import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthUser, useAuth } from "../../authContext";
import { ShopInfo } from "../../data/shops";
import { useCurrentAccount } from "../../hooks/useCurrentAccount";
import { useShops } from "../../hooks/useShops";
import "./styles.css";

type Wallet = "emola" | "mpesa";
type ShopActionPanel = "service" | "tasks" | "catalog";

type CatalogFormState = {
    name: string;
    price: string;
    averageTime: string;
};

type ApiManagerService = {
    id: number | string;
    joined_queue_at?: string | null;
    left_queue_at?: string | null;
    status?: string | null;
    position?: number | string | null;
    start_time?: string | null;
    finish_time?: string | null;
    paid_via_account?: boolean | null;
    manual_payment_confirmed?: boolean | null;
    manual_payment_confirmed_at?: string | null;
    refund_confirmed?: boolean | null;
    refund_confirmed_at?: string | null;
    queue?:
        | {
              id?: number | string;
              name?: string | null;
              shop?: { id?: number | string; name?: string | null } | number | string | null;
              barber?:
                  | {
                        id?: number | string;
                        user?: { id?: number | string } | number | string | null;
                        shop?: { id?: number | string } | number | string | null;
                    }
                  | number
                  | string
                  | null;
          }
        | number
        | string
        | null;
    service_type?:
        | {
              id?: number | string;
              name?: string | null;
              price?: number | string | null;
              barbershop?: { id?: number | string; name?: string | null } | number | string | null;
          }
        | null;
    customer?:
        | {
              id?: number | string;
              first_name?: string | null;
              last_name?: string | null;
              email?: string | null;
          }
        | number
        | string
        | null;
};

type ApiManagerQueue = {
    id: number | string;
    name?: string | null;
    status?: string | null;
    shop?: { id?: number | string; name?: string | null } | number | string | null;
    barber?:
        | {
              id?: number | string;
              user?: { id?: number | string } | number | string | null;
              shop?: { id?: number | string; name?: string | null } | number | string | null;
          }
        | number
        | string
        | null;
};

type ApiCatalogServiceType = {
    id: number | string;
    name?: string | null;
    price?: number | string | null;
    average_time?: string | null;
    barbershop?: { id?: number | string; name?: string | null } | number | string | null;
};

type ApiManagerTransaction = {
    id: number | string;
    tx_type?: string | null;
    transaction_group?: string | null;
    reference?: string | null;
    amount?: number | string | null;
    created_at?: string | null;
    ordering_account?: { id?: number | string | null } | null;
    beneficiary_account?: { id?: number | string | null } | null;
    service?: { id?: number | string | null } | number | string | null;
    created_by?: {
        id?: number | string | null;
        first_name?: string | null;
        last_name?: string | null;
        email?: string | null;
    } | null;
    description?: string | null;
};

type ShopTask = {
    id: string;
    kind: "manual_payment" | "refund";
    serviceId: string;
    title: string;
    detail: string;
    amountLabel: string;
    customerName: string;
    serviceName: string;
    actionLabel: string;
    createdLabel: string;
};

type ShopServiceAction = {
    id: string;
    serviceId: string;
    kind: "start" | "complete";
    title: string;
    detail: string;
    customerName: string;
    serviceName: string;
    queueName: string;
    actionLabel: string;
    createdLabel: string;
    statusLabel: string;
};

type DashboardStat = {
    label: string;
    value: string;
    hint: string;
    secondaryLabel?: string;
    secondaryValue?: string;
    secondaryHint?: string;
    breakdown?: "clients" | "realized" | "wait" | "queues" | "cash" | "tips";
};

type ProfileUser = {
    name: string;
    email: string;
    telefone: string;
    bairro: string;
};

function buildProfileUser(authUser: AuthUser | null): ProfileUser {
    const fullName = [authUser?.first_name?.trim(), authUser?.last_name?.trim()].filter(Boolean).join(" ").trim();
    const fallbackName = authUser?.first_name?.trim() || authUser?.username?.trim() || authUser?.email?.split("@")[0] || "Utilizador";

    return {
        name: fullName || fallbackName,
        email: authUser?.email || "",
        telefone: authUser?.telefone?.trim() || "Por definir",
        bairro: authUser?.bairro?.trim() || "Por definir",
    };
}

function parseAccountBalance(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

function formatCatalogPrice(value: unknown) {
    const amount = parseAccountBalance(value);
    return `${amount.toLocaleString("pt-PT")} MZN`;
}

function formatAverageTimeLabel(value?: string | null) {
    if (!value) return "Tempo medio por definir";
    const parts = value.split(":");
    if (parts.length < 2) return value;
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
}

function normalizeTimeInput(value: string) {
    if (!value) return "00:30:00";
    return value.length === 5 ? `${value}:00` : value;
}

async function readErrorMessage(response: Response, fallback: string) {
    try {
        const data = await response.json();
        if (typeof data === "string") return data;
        if (data && typeof data === "object") {
            const values = Object.values(data as Record<string, unknown>).flatMap((value) =>
                Array.isArray(value) ? value.map(String) : [String(value)]
            );
            return values.filter(Boolean).join(" ") || fallback;
        }
    } catch {
        const text = await response.text();
        if (text.trim()) return text;
    }
    return fallback;
}

const WALLET_DETAILS: Record<Wallet, { label: string; number: string; logo: string }> = {
    emola: {
        label: "E-Mola",
        number: "*898#",
        logo: "/wallets/emola.png",
    },
    mpesa: {
        label: "M-Pesa",
        number: "*841#",
        logo: "/wallets/mpesa.png",
    },
};

const WAIT_TYPES = ["Corte classico", "Barba", "Penteado rapido", "Desenho/linha"];
const WAIT_TIMES: Record<string, string> = {
    "Corte classico": "~12 min",
    Barba: "~9 min",
    "Penteado rapido": "~7 min",
    "Desenho/linha": "~15 min",
};
const API_BASE = process.env.REACT_APP_API_BASE || "/api";

function getNestedId(value: unknown): string | null {
    if (value == null) return null;
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (typeof value === "object" && "id" in value) {
        const nested = (value as { id?: string | number | null }).id;
        return nested == null ? null : String(nested);
    }
    return null;
}

function buildPersonLabel(person?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
} | null) {
    const fullName = [person?.first_name?.trim(), person?.last_name?.trim()].filter(Boolean).join(" ").trim();
    return fullName || person?.email?.trim() || "Cliente";
}

function formatTaskMoment(value?: string | null) {
    if (!value) return "Agora";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Agora";

    return date.toLocaleString("pt-MZ", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function getServiceStatus(value?: string | null) {
    const upper = String(value || "").toUpperCase();
    if (upper === "IN_SERVICE") return "IN_SERVICE";
    if (upper === "COMPLETED") return "COMPLETED";
    if (upper === "CANCELLED") return "CANCELLED";
    return "QUEUED";
}

function getServiceStatusLabel(value?: string | null) {
    const status = getServiceStatus(value);
    if (status === "IN_SERVICE") return "Em atendimento";
    if (status === "COMPLETED") return "Concluido";
    if (status === "CANCELLED") return "Cancelado";
    return "Em espera";
}

function getMaputoDateKey(value?: string | null) {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Africa/Maputo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(date);
}

function shiftDateKey(dateKey: string, days: number) {
    const [year, month, day] = dateKey.split("-").map((part) => Number.parseInt(part, 10));
    if (!year || !month || !day) return dateKey;

    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + days);

    return date.toISOString().slice(0, 10);
}

function formatTrendLabel(dateKey: string) {
    const [year, month, day] = dateKey.split("-").map((part) => Number.parseInt(part, 10));
    if (!year || !month || !day) return dateKey;

    return new Intl.DateTimeFormat("pt-PT", {
        timeZone: "Africa/Maputo",
        day: "2-digit",
        month: "2-digit",
    }).format(new Date(Date.UTC(year, month - 1, day)));
}

function leftBeforeService(service: ApiManagerService) {
    return !service.start_time && !service.finish_time && (getServiceStatus(service.status) === "CANCELLED" || Boolean(service.left_queue_at));
}

function getServiceQueueName(service: ApiManagerService) {
    return typeof service.queue === "object" && service.queue ? service.queue.name?.trim() || "Fila" : "Fila";
}

function parsePosition(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
    }
    return Number.MAX_SAFE_INTEGER;
}

function ActionTileIcon({ panel }: { panel: ShopActionPanel }) {
    if (panel === "service") {
        return (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 4h10a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
                <path d="M8 16h8M12 12v8" />
            </svg>
        );
    }

    if (panel === "catalog") {
        return (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16.5A1.5 1.5 0 0 1 18.5 21H6.5A2.5 2.5 0 0 1 4 18.5v-13Z" />
                <path d="M8 7h8M8 11h8M8 15h5" />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 4h10a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2Z" />
            <path d="M9 8h6M9 12h6" />
        </svg>
    );
}

function getRoleLabel(apiRole?: string, fallbackRole?: string | null) {
    const upper = apiRole?.toUpperCase();

    if (upper === "CUSTOMER") return "Cliente";
    if (upper === "BARBER") return "Barbeiro";
    if (upper === "SHOP_ADMIN") return "Gestor";
    if (upper === "SYS_ADMIN" || upper === "ADMIN") return "Admin";

    if (fallbackRole === "C") return "Cliente";
    if (fallbackRole === "B") return "Barbeiro";
    if (fallbackRole === "A") return "Admin";

    return "Utilizador";
}

export default function Profile() {
    const { role, user: authUser, updateUser, accessToken } = useAuth();
    const {
        balance,
        hasCurrentAccount,
        refresh: refreshCurrentAccount,
        getShopAccount,
        shopAccounts,
        loading: accountsLoading,
    } = useCurrentAccount();
    const { shops: fetchedShops, loading: shopsLoading, error: shopsError, usingFallback, reload: reloadShops } = useShops();
    const apiRole = String(authUser?.role || "").toUpperCase();
    const isBarber = role === "B" || apiRole === "BARBER";
    const isSysAdmin = ["SYS_ADMIN", "ADMIN"].includes(apiRole);
    const isShopAdmin = apiRole === "SHOP_ADMIN";
    const canManageCatalog = isSysAdmin || isShopAdmin;
    const canManageFinancials = isSysAdmin || isShopAdmin;
    const canManageExecution = isSysAdmin || isShopAdmin || isBarber;
    const canManageShop = canManageCatalog || canManageFinancials || canManageExecution;
    const roleLabel = getRoleLabel(authUser?.role, role);
    const authProfile = useMemo(() => buildProfileUser(authUser), [authUser]);
    const persistedPhoto = authUser?.profile_picture?.trim() || null;
    const [managerQueues, setManagerQueues] = useState<ApiManagerQueue[]>([]);
    const [managerServices, setManagerServices] = useState<ApiManagerService[]>([]);
    const [managerTransactions, setManagerTransactions] = useState<ApiManagerTransaction[]>([]);
    const managedShopIds = useMemo(() => {
        const shopIds = new Set<string>();

        shopAccounts.forEach((account) => {
            const shopId = getNestedId(account.shop);
            if (shopId) shopIds.add(shopId);
        });

        managerQueues.forEach((queue) => {
            const shopId = getNestedId(queue.shop);
            if (shopId) shopIds.add(shopId);

            if (typeof queue.barber === "object" && queue.barber) {
                const barberShopId = getNestedId("shop" in queue.barber ? queue.barber.shop : null);
                if (barberShopId) shopIds.add(barberShopId);
            }
        });

        managerServices.forEach((service) => {
            if (typeof service.queue === "object" && service.queue) {
                const queueShopId = getNestedId(service.queue.shop);
                if (queueShopId) shopIds.add(queueShopId);

                const barberValue = "barber" in service.queue ? service.queue.barber : null;
                if (typeof barberValue === "object" && barberValue) {
                    const barberShopId = getNestedId("shop" in barberValue ? barberValue.shop : null);
                    if (barberShopId) shopIds.add(barberShopId);
                }
            }

            const serviceShopId = getNestedId(service.service_type?.barbershop);
            if (serviceShopId) shopIds.add(serviceShopId);
        });

        return shopIds;
    }, [managerQueues, managerServices, shopAccounts]);
    const adminShops = useMemo(() => {
        if (usingFallback) return [];
        if (isSysAdmin) return fetchedShops;

        if (isShopAdmin) {
            return fetchedShops.filter((shop) => managedShopIds.has(shop.id));
        }

        if (isBarber && authUser?.id != null) {
            const barberUserId = String(authUser.id);
            const assignedShopIds = new Set<string>();

            managerQueues.forEach((queue) => {
                const queueBarberUserId =
                    typeof queue.barber === "object" && queue.barber
                        ? getNestedId("user" in queue.barber ? queue.barber.user : null)
                        : null;
                const queueShopId = getNestedId(queue.shop);

                if (queueBarberUserId === barberUserId && queueShopId) {
                    assignedShopIds.add(queueShopId);
                }
            });

            managerServices.forEach((service) => {
                const queueBarberUserId =
                    typeof service.queue === "object" && service.queue
                        ? (() => {
                              const barberValue = "barber" in service.queue ? service.queue.barber : null;
                              if (typeof barberValue === "object" && barberValue) {
                                  return getNestedId("user" in barberValue ? barberValue.user : null);
                              }
                              return null;
                          })()
                        : null;
                const queueShopId =
                    typeof service.queue === "object" && service.queue ? getNestedId(service.queue.shop) : null;
                const serviceShopId = getNestedId(service.service_type?.barbershop);

                if (queueBarberUserId === barberUserId) {
                    if (queueShopId) assignedShopIds.add(queueShopId);
                    if (serviceShopId) assignedShopIds.add(serviceShopId);
                }
            });

            return fetchedShops.filter((shop) => assignedShopIds.has(shop.id));
        }

        return [];
    }, [authUser?.id, fetchedShops, isBarber, isShopAdmin, isSysAdmin, managedShopIds, managerQueues, managerServices, usingFallback]);
    const [profileUser, setProfileUser] = useState<ProfileUser>(authProfile);
    const [editable, setEditable] = useState<ProfileUser>(authProfile);
    const [editing, setEditing] = useState(false);
    const [profileError, setProfileError] = useState("");
    const [savingProfile, setSavingProfile] = useState(false);
    const [photo, setPhoto] = useState<string | null>(null);
    const [wallet, setWallet] = useState<Wallet>("emola");
    const [transactionId, setTransactionId] = useState("");
    const [error, setError] = useState("");
    const [selectedShopId, setSelectedShopId] = useState("");
    const [catalogServiceTypes, setCatalogServiceTypes] = useState<ApiCatalogServiceType[]>([]);
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [catalogError, setCatalogError] = useState("");
    const [catalogSaving, setCatalogSaving] = useState(false);
    const [catalogMessage, setCatalogMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [catalogForm, setCatalogForm] = useState<CatalogFormState>({
        name: "",
        price: "",
        averageTime: "00:30",
    });
    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [profileOwnerId, setProfileOwnerId] = useState<number | null>(authUser?.id ?? null);
    const [shopDraft, setShopDraft] = useState({
        id: "",
        name: "",
        location: "",
        description: "",
    });
    const [waitType, setWaitType] = useState<string>(WAIT_TYPES[0]);
    const [realizedViewMode, setRealizedViewMode] = useState<"today" | "week">("today");
    const [cashChartMode, setCashChartMode] = useState(false);
    const [shopPanelModal, setShopPanelModal] = useState<ShopActionPanel | null>(null);
    const [managerDataLoading, setManagerDataLoading] = useState(false);
    const [managerDataError, setManagerDataError] = useState("");
    const [managerActionId, setManagerActionId] = useState<string | null>(null);
    const [managerActionMessage, setManagerActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [taskModal, setTaskModal] = useState<ShopTask | null>(null);
    const [serviceActionId, setServiceActionId] = useState<string | null>(null);
    const [serviceActionMessage, setServiceActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [serviceModal, setServiceModal] = useState<ShopServiceAction | null>(null);

    useEffect(() => {
        if (!canManageShop) return;

        if (!adminShops.length) {
            setSelectedShopId("");
            return;
        }

        setSelectedShopId((current) => (adminShops.some((shop) => shop.id === current) ? current : adminShops[0].id));
    }, [adminShops, canManageShop]);

    useEffect(() => {
        const shop = adminShops.find((item) => item.id === selectedShopId);
        if (!shop) {
            setShopDraft({ id: "", name: "", location: "", description: "" });
            return;
        }

        setShopDraft({
            id: shop.id,
            name: shop.name,
            location: shop.location ?? "",
            description: shop.description ?? "",
        });
    }, [adminShops, selectedShopId]);

    useEffect(() => {
        const authUserId = authUser?.id ?? null;

        if (authUserId !== profileOwnerId) {
            setProfileUser(authProfile);
            setEditable(authProfile);
            setProfileOwnerId(authUserId);
            return;
        }

        setProfileUser((current) => ({
            ...current,
            name: authProfile.name,
            email: authProfile.email,
            telefone: authProfile.telefone,
            bairro: authProfile.bairro,
        }));

        if (!editing) {
            setEditable((current) => ({
                ...current,
                name: authProfile.name,
                email: authProfile.email,
                telefone: authProfile.telefone,
                bairro: authProfile.bairro,
            }));
        }
    }, [authProfile, authUser?.id, editing, profileOwnerId]);

    useEffect(() => {
        setWaitType(WAIT_TYPES[0]);
    }, [selectedShopId]);

    const refreshManagerData = useCallback(
        async (signal?: AbortSignal) => {
            if (!canManageShop || !accessToken) {
                setManagerQueues([]);
                setManagerServices([]);
                setManagerTransactions([]);
                setManagerDataError("");
                setManagerDataLoading(false);
                return;
            }

            setManagerDataLoading(true);
            setManagerDataError("");

            try {
                const headers = {
                    Accept: "application/json",
                    Authorization: `Bearer ${accessToken}`,
                };

                const [queuesResponse, servicesResponse, transactionsResponse] = await Promise.all([
                    fetch(`${API_BASE}/queues/`, { headers, signal }),
                    fetch(`${API_BASE}/services/`, { headers, signal }),
                    canManageFinancials ? fetch(`${API_BASE}/account-transactions/`, { headers, signal }) : Promise.resolve(null),
                ]);

                if (!queuesResponse.ok) {
                    throw new Error(`Falha ao carregar filas (${queuesResponse.status})`);
                }

                if (!servicesResponse.ok) {
                    throw new Error(`Falha ao carregar servicos (${servicesResponse.status})`);
                }

                if (transactionsResponse && !transactionsResponse.ok) {
                    throw new Error(`Falha ao carregar tarefas financeiras (${transactionsResponse.status})`);
                }

                const queuesData = (await queuesResponse.json()) as ApiManagerQueue[];
                const servicesData = (await servicesResponse.json()) as ApiManagerService[];
                const transactionsData = transactionsResponse
                    ? ((await transactionsResponse.json()) as ApiManagerTransaction[])
                    : [];

                if (signal?.aborted) return;

                setManagerQueues(Array.isArray(queuesData) ? queuesData : []);
                setManagerServices(Array.isArray(servicesData) ? servicesData : []);
                setManagerTransactions(Array.isArray(transactionsData) ? transactionsData : []);
            } catch (err) {
                if (signal?.aborted) return;
                setManagerQueues([]);
                setManagerServices([]);
                setManagerTransactions([]);
                setManagerDataError(err instanceof Error ? err.message : "Falha ao carregar tarefas");
            } finally {
                if (!signal?.aborted) {
                    setManagerDataLoading(false);
                }
            }
        },
        [accessToken, canManageFinancials, canManageShop]
    );

    useEffect(() => {
        const controller = new AbortController();
        void refreshManagerData(controller.signal);
        return () => controller.abort();
    }, [refreshManagerData]);

    const refreshCatalog = useCallback(
        async (signal?: AbortSignal) => {
            if (!canManageCatalog) {
                setCatalogServiceTypes([]);
                setCatalogLoading(false);
                setCatalogError("");
                return;
            }

            setCatalogLoading(true);
            setCatalogError("");

            try {
                const response = await fetch(`${API_BASE}/service-types/`, {
                    headers: {
                        Accept: "application/json",
                        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                    },
                    signal,
                });

                if (!response.ok) {
                    throw new Error(`Falha ao carregar catalogo (${response.status})`);
                }

                const data = (await response.json()) as ApiCatalogServiceType[];
                if (signal?.aborted) return;
                setCatalogServiceTypes(Array.isArray(data) ? data : []);
            } catch (error) {
                if (signal?.aborted) return;
                setCatalogServiceTypes([]);
                setCatalogError(error instanceof Error ? error.message : "Falha ao carregar catalogo");
            } finally {
                if (!signal?.aborted) {
                    setCatalogLoading(false);
                }
            }
        },
        [accessToken, canManageCatalog]
    );

    useEffect(() => {
        const controller = new AbortController();
        void refreshCatalog(controller.signal);
        return () => controller.abort();
    }, [refreshCatalog]);

    useEffect(() => {
        setCatalogForm({
            name: "",
            price: "",
            averageTime: "00:30",
        });
        setCatalogMessage(null);
    }, [selectedShopId]);

    const selectedShop = useMemo(() => adminShops.find((shop) => shop.id === selectedShopId), [adminShops, selectedShopId]);
    const selectedCatalogServices = useMemo(
        () =>
            catalogServiceTypes
                .filter((service) => getNestedId(service.barbershop) === selectedShopId)
                .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""))),
        [catalogServiceTypes, selectedShopId]
    );
    const selectedShopAccount = useMemo(() => getShopAccount(selectedShopId), [getShopAccount, selectedShopId]);
    const selectedShopBalance = useMemo(() => parseAccountBalance(selectedShopAccount?.balance), [selectedShopAccount?.balance]);
    const selectedShopHasCurrentAccount = Boolean(selectedShopAccount?.id) && Boolean(selectedShopAccount?.is_active);
    const selectedShopBalanceLabel = useMemo(() => {
        if (!selectedShopId) return "Sem barbearia";
        if (accountsLoading && !selectedShopAccount) return "A carregar...";
        if (!selectedShopHasCurrentAccount) return "Sem conta corrente";
        return `${selectedShopBalance.toLocaleString("pt-PT")} MZN`;
    }, [accountsLoading, selectedShopAccount, selectedShopBalance, selectedShopHasCurrentAccount, selectedShopId]);

    const queueWaits = useMemo(
        () =>
            selectedShop?.queues.map((queue) => {
                const wait = WAIT_TIMES[waitType] ?? queue.waitEstimate;
                return { name: queue.name, wait };
            }) ?? [],
        [selectedShop, waitType]
    );
    const selectedShopServices = useMemo(
        () =>
            managerServices.filter((service) => {
                const queueShopId =
                    typeof service.queue === "object" && service.queue
                        ? getNestedId(service.queue.shop)
                        : null;
                const serviceTypeShopId = getNestedId(service.service_type?.barbershop);
                return queueShopId === selectedShopId || serviceTypeShopId === selectedShopId;
            }),
        [managerServices, selectedShopId]
    );
    const selectedShopServiceMap = useMemo(
        () => new Map(selectedShopServices.map((service) => [String(service.id), service])),
        [selectedShopServices]
    );
    const selectedShopServicePayments = useMemo(() => {
        const totals = new Map<string, number>();

        managerTransactions.forEach((tx) => {
            if (String(tx.tx_type || "").toUpperCase() !== "SERVICE_PAYMENT") return;

            const serviceId = getNestedId(tx.service);
            if (!serviceId || !selectedShopServiceMap.has(serviceId)) return;

            totals.set(serviceId, (totals.get(serviceId) ?? 0) + parseAccountBalance(tx.amount));
        });

        return totals;
    }, [managerTransactions, selectedShopServiceMap]);
    const selectedShopServiceTips = useMemo(() => {
        const totals = new Map<string, number>();

        managerTransactions.forEach((tx) => {
            if (String(tx.tx_type || "").toUpperCase() !== "ADJUSTMENT") return;
            if (!String(tx.reference || "").toLowerCase().startsWith("tip-")) return;

            const serviceId = getNestedId(tx.service);
            if (!serviceId || !selectedShopServiceMap.has(serviceId)) return;

            totals.set(serviceId, (totals.get(serviceId) ?? 0) + parseAccountBalance(tx.amount));
        });

        return totals;
    }, [managerTransactions, selectedShopServiceMap]);
    const selectedDateServices = useMemo(
        () =>
            selectedShopServices.filter((service) => {
                const serviceDate =
                    getMaputoDateKey(service.joined_queue_at) ||
                    getMaputoDateKey(service.start_time) ||
                    getMaputoDateKey(service.finish_time) ||
                    getMaputoDateKey(service.left_queue_at);
                return serviceDate === selectedDate;
            }),
        [selectedDate, selectedShopServices]
    );
    const selectedDateClientsTotal = selectedDateServices.length;
    const selectedDateExitedBeforeService = useMemo(
        () => selectedDateServices.filter((service) => leftBeforeService(service)).length,
        [selectedDateServices]
    );
    const clientTrend = useMemo(() => {
        const counts = new Map<string, number>();

        selectedShopServices.forEach((service) => {
            const serviceDate =
                getMaputoDateKey(service.joined_queue_at) ||
                getMaputoDateKey(service.start_time) ||
                getMaputoDateKey(service.finish_time) ||
                getMaputoDateKey(service.left_queue_at);
            if (!serviceDate) return;
            counts.set(serviceDate, (counts.get(serviceDate) ?? 0) + 1);
        });

        return Array.from({ length: 7 }, (_, index) => {
            const dateKey = shiftDateKey(selectedDate, index - 6);
            return {
                dateKey,
                label: formatTrendLabel(dateKey),
                count: counts.get(dateKey) ?? 0,
            };
        });
    }, [selectedDate, selectedShopServices]);
    const manualPendingServices = useMemo(
        () =>
            selectedDateServices.filter(
                (service) => !service.paid_via_account && !service.manual_payment_confirmed && !leftBeforeService(service)
            ),
        [selectedDateServices]
    );
    const manualPendingAmount = useMemo(
        () => manualPendingServices.reduce((sum, service) => sum + parseAccountBalance(service.service_type?.price), 0),
        [manualPendingServices]
    );
    const manualConfirmedServices = useMemo(
        () =>
            selectedDateServices.filter(
                (service) => !service.paid_via_account && Boolean(service.manual_payment_confirmed) && !leftBeforeService(service)
            ),
        [selectedDateServices]
    );
    const manualConfirmedAmount = useMemo(
        () =>
            manualConfirmedServices.reduce(
                (sum, service) =>
                    sum +
                    (selectedShopServicePayments.get(String(service.id)) ?? parseAccountBalance(service.service_type?.price)),
                0
            ),
        [manualConfirmedServices, selectedShopServicePayments]
    );
    const selectedShopTipBreakdown = useMemo(() => {
        const totals = new Map<string, { name: string; amount: number; count: number }>();

        selectedDateServices.forEach((service) => {
            if (leftBeforeService(service) || service.refund_confirmed) return;

            const tipAmount = selectedShopServiceTips.get(String(service.id)) ?? 0;
            if (tipAmount <= 0) return;

            const queueName = getServiceQueueName(service);
            const current = totals.get(queueName) ?? { name: queueName, amount: 0, count: 0 };
            current.amount += tipAmount;
            current.count += 1;
            totals.set(queueName, current);
        });

        return Array.from(totals.values()).sort((left, right) => right.amount - left.amount || left.name.localeCompare(right.name));
    }, [selectedDateServices, selectedShopServiceTips]);
    const selectedShopTipsTotal = useMemo(
        () => selectedShopTipBreakdown.reduce((sum, item) => sum + item.amount, 0),
        [selectedShopTipBreakdown]
    );
    const realizedAmount = useMemo(
        () =>
            selectedDateServices.reduce((sum, service) => {
                if (leftBeforeService(service) || service.refund_confirmed) return sum;

                const serviceId = String(service.id);
                const serviceAmount = selectedShopServicePayments.get(serviceId) ?? 0;
                const tipAmount = selectedShopServiceTips.get(serviceId) ?? 0;

                return sum + serviceAmount + tipAmount;
            }, 0),
        [selectedDateServices, selectedShopServicePayments, selectedShopServiceTips]
    );
    const realizedTrend = useMemo(() => {
        const totals = new Map<string, number>();

        selectedShopServices.forEach((service) => {
            const serviceDate =
                getMaputoDateKey(service.joined_queue_at) ||
                getMaputoDateKey(service.start_time) ||
                getMaputoDateKey(service.finish_time) ||
                getMaputoDateKey(service.left_queue_at);
            if (!serviceDate) return;
            if (leftBeforeService(service) || service.refund_confirmed) return;

            const serviceId = String(service.id);
            const realized = (selectedShopServicePayments.get(serviceId) ?? 0) + (selectedShopServiceTips.get(serviceId) ?? 0);
            if (realized <= 0) return;

            totals.set(serviceDate, (totals.get(serviceDate) ?? 0) + realized);
        });

        return Array.from({ length: 7 }, (_, index) => {
            const dateKey = shiftDateKey(selectedDate, index - 6);
            return {
                dateKey,
                label: formatTrendLabel(dateKey),
                amount: totals.get(dateKey) ?? 0,
            };
        });
    }, [selectedDate, selectedShopServicePayments, selectedShopServiceTips, selectedShopServices]);
    const paymentMethodAmountTrend = useMemo(() => {
        const totals = new Map<string, { accountAmount: number; cashAmount: number }>();

        selectedShopServices.forEach((service) => {
            const serviceDate =
                getMaputoDateKey(service.joined_queue_at) ||
                getMaputoDateKey(service.start_time) ||
                getMaputoDateKey(service.finish_time) ||
                getMaputoDateKey(service.left_queue_at);
            if (!serviceDate) return;
            if (leftBeforeService(service) || service.refund_confirmed) return;

            const serviceId = String(service.id);
            const servicePayment = selectedShopServicePayments.get(serviceId) ?? 0;
            const tipAmount = selectedShopServiceTips.get(serviceId) ?? 0;
            const current = totals.get(serviceDate) ?? { accountAmount: 0, cashAmount: 0 };

            if (service.paid_via_account) {
                current.accountAmount += servicePayment + tipAmount;
            } else if (service.manual_payment_confirmed) {
                current.cashAmount += servicePayment || parseAccountBalance(service.service_type?.price);
            } else {
                return;
            }

            totals.set(serviceDate, current);
        });

        return Array.from({ length: 7 }, (_, index) => {
            const dateKey = shiftDateKey(selectedDate, index - 6);
            const daily = totals.get(dateKey) ?? { accountAmount: 0, cashAmount: 0 };

            return {
                dateKey,
                label: formatTrendLabel(dateKey),
                accountAmount: daily.accountAmount,
                cashAmount: daily.cashAmount,
            };
        });
    }, [selectedDate, selectedShopServicePayments, selectedShopServiceTips, selectedShopServices]);
    const expectedReportedAmount = useMemo(
        () => realizedAmount + manualPendingAmount,
        [manualPendingAmount, realizedAmount]
    );
    const manualPaymentTotal = useMemo(
        () => manualPendingAmount + manualConfirmedAmount,
        [manualConfirmedAmount, manualPendingAmount]
    );
    const adminStats = useMemo<DashboardStat[]>(() => {
        const stats: DashboardStat[] = [
            {
                label: "Clientes do dia",
                value: `${selectedDateClientsTotal}`,
                hint:
                    selectedDateExitedBeforeService > 0
                        ? `${selectedDateExitedBeforeService} saiu(sairam) antes do atendimento`
                        : "Sem saidas antes do atendimento",
                breakdown: "clients",
            },
            {
                label: "Total realizado",
                value: `${realizedAmount.toLocaleString("pt-PT")} MZN`,
                hint:
                    selectedShopTipsTotal > 0
                        ? `Inclui ${selectedShopTipsTotal.toLocaleString("pt-PT")} MZN em gorjetas`
                        : "Sem gorjetas contabilizadas neste dia",
                secondaryLabel: "Total esperado",
                secondaryValue: `${expectedReportedAmount.toLocaleString("pt-PT")} MZN`,
                secondaryHint:
                    manualPendingAmount > 0
                        ? `Inclui ${manualPendingAmount.toLocaleString("pt-PT")} MZN pendentes em numerario`
                        : "Sem pagamentos manuais pendentes neste dia",
                breakdown: "realized",
            },
        ];

        if (canManageFinancials) {
            stats.push(
                {
                    label: "Filas ativas",
                    value: `${selectedShop?.queues.length ?? 0}`,
                    hint: "",
                    breakdown: "queues",
                },
                {
                    label: "Pagamentos em numerario",
                    value: `${manualPaymentTotal.toLocaleString("pt-PT")} MZN`,
                    hint: `${manualPendingServices.length + manualConfirmedServices.length} registo(s) manuais`,
                    breakdown: "cash",
                },
                {
                    label: "Gorjetas",
                    value: `${selectedShopTipsTotal.toLocaleString("pt-PT")} MZN`,
                    hint: `${selectedShopTipBreakdown.reduce((sum, item) => sum + item.count, 0)} gorjeta(s) contabilizadas`,
                    breakdown: "tips",
                }
            );
        }

        return stats;
    }, [
        canManageFinancials,
        expectedReportedAmount,
        manualConfirmedAmount,
        manualConfirmedServices.length,
        manualPaymentTotal,
        manualPendingAmount,
        manualPendingServices.length,
        realizedAmount,
        selectedDateClientsTotal,
        selectedDateExitedBeforeService,
        selectedShop,
        selectedShopTipBreakdown,
        selectedShopTipsTotal,
    ]);
    const selectedShopTasks = useMemo(() => {
        const tasks: ShopTask[] = [];
        const refundGroups = new Set(
            managerTransactions
                .filter((tx) => String(tx.tx_type || "").toUpperCase() === "REFUND")
                .map((tx) => tx.transaction_group)
                .filter((value): value is string => Boolean(value))
        );

        selectedShopServices.forEach((service) => {
            if (service.finish_time || service.left_queue_at || service.paid_via_account || service.manual_payment_confirmed) return;

            const customer =
                typeof service.customer === "object" && service.customer ? service.customer : null;
            const serviceName = service.service_type?.name?.trim() || `Servico #${service.id}`;
            const amount = parseAccountBalance(service.service_type?.price);

            tasks.push({
                id: `manual-${service.id}`,
                kind: "manual_payment",
                serviceId: String(service.id),
                title: "Confirmar pagamento manual",
                detail: "Cliente entrou na fila pagando apenas a taxa de reserva. Confirmar o recebimento presencial do servico.",
                amountLabel: `${amount.toLocaleString("pt-PT")} MZN`,
                customerName: buildPersonLabel(customer),
                serviceName,
                actionLabel: "Confirmar pagamento",
                createdLabel: formatTaskMoment(service.joined_queue_at),
            });
        });

        const selectedShopAccountId = selectedShopAccount?.id == null ? null : String(selectedShopAccount.id);

        managerTransactions.forEach((tx) => {
            if (String(tx.tx_type || "").toUpperCase() !== "SERVICE_PAYMENT") return;
            if (!tx.transaction_group || refundGroups.has(tx.transaction_group)) return;
            if (selectedShopAccountId && getNestedId(tx.beneficiary_account) !== selectedShopAccountId) return;

            const linkedServiceId = getNestedId(tx.service);
            if (!linkedServiceId) return;

            const linkedService = selectedShopServiceMap.get(linkedServiceId);
            const linkedServiceStatus = getServiceStatus(linkedService?.status);
            const leftBeforeService = linkedServiceStatus === "CANCELLED" || Boolean(linkedService?.left_queue_at);
            if (!leftBeforeService) return;
            if (linkedService?.start_time || linkedService?.finish_time) return;
            if (linkedService?.refund_confirmed) return;

            tasks.push({
                id: `refund-${tx.id}`,
                kind: "refund",
                serviceId: linkedServiceId,
                title: "Confirmar reembolso",
                detail: "O cliente pagou o servico pela conta e saiu da fila sem ser atendido. Confirmar o reembolso do valor do servico.",
                amountLabel: `${parseAccountBalance(tx.amount).toLocaleString("pt-PT")} MZN`,
                customerName: buildPersonLabel(
                    (typeof linkedService?.customer === "object" && linkedService.customer ? linkedService.customer : null) ||
                        tx.created_by
                ),
                serviceName: linkedService?.service_type?.name?.trim() || tx.description?.trim() || `Pagamento ${tx.id}`,
                actionLabel: "Confirmar reembolso",
                createdLabel: formatTaskMoment(tx.created_at),
            });
        });

        return tasks;
    }, [managerTransactions, selectedShopAccount?.id, selectedShopServiceMap, selectedShopServices]);
    const selectedShopServiceActions = useMemo<ShopServiceAction[]>(() => {
        const grouped = new Map<string, ApiManagerService[]>();

        selectedShopServices.forEach((service) => {
            const status = getServiceStatus(service.status);
            if (!["QUEUED", "IN_SERVICE"].includes(status)) return;

            const queueId =
                typeof service.queue === "object" && service.queue
                    ? getNestedId(service.queue)
                    : getNestedId(service.queue);

            if (!queueId) return;

            const existing = grouped.get(queueId) ?? [];
            existing.push(service);
            grouped.set(queueId, existing);
        });

        const actions: ShopServiceAction[] = [];

        Array.from(grouped.values()).forEach((services) => {
                const ordered = services
                    .slice()
                    .sort((a, b) => {
                        const aStatus = getServiceStatus(a.status);
                        const bStatus = getServiceStatus(b.status);
                        const aWeight = aStatus === "IN_SERVICE" ? 0 : 1;
                        const bWeight = bStatus === "IN_SERVICE" ? 0 : 1;

                        if (aWeight !== bWeight) return aWeight - bWeight;

                        const aPosition = parsePosition(a.position);
                        const bPosition = parsePosition(b.position);
                        if (aPosition !== bPosition) return aPosition - bPosition;

                        return String(a.joined_queue_at || "").localeCompare(String(b.joined_queue_at || ""));
                    });

                const activeService = ordered.find((service) => getServiceStatus(service.status) === "IN_SERVICE");
                if (activeService) {
                    const customer =
                        typeof activeService.customer === "object" && activeService.customer ? activeService.customer : null;
                    const queueName =
                        typeof activeService.queue === "object" && activeService.queue
                            ? activeService.queue.name?.trim() || "Fila"
                            : "Fila";

                    actions.push({
                        id: `complete-${activeService.id}`,
                        serviceId: String(activeService.id),
                        kind: "complete",
                        title: "Concluir atendimento",
                        detail: "Marque o servico como concluido quando o atendimento terminar.",
                        customerName: buildPersonLabel(customer),
                        serviceName: activeService.service_type?.name?.trim() || `Servico #${activeService.id}`,
                        queueName,
                        actionLabel: "Concluir",
                        createdLabel: formatTaskMoment(activeService.start_time || activeService.joined_queue_at),
                        statusLabel: getServiceStatusLabel(activeService.status),
                    });
                    return;
                }

                const queued = ordered.filter((service) => getServiceStatus(service.status) === "QUEUED");
                const nextService = queued[0];
                if (!nextService) return;

                const customer = typeof nextService.customer === "object" && nextService.customer ? nextService.customer : null;
                const queueName =
                    typeof nextService.queue === "object" && nextService.queue
                        ? nextService.queue.name?.trim() || "Fila"
                        : "Fila";

                actions.push({
                    id: `start-${nextService.id}`,
                    serviceId: String(nextService.id),
                    kind: "start",
                    title: "Iniciar atendimento",
                    detail: "Inicie o atendimento do proximo cliente desta fila.",
                    customerName: buildPersonLabel(customer),
                    serviceName: nextService.service_type?.name?.trim() || `Servico #${nextService.id}`,
                    queueName,
                    actionLabel: "Iniciar",
                    createdLabel: formatTaskMoment(nextService.joined_queue_at),
                    statusLabel: getServiceStatusLabel(nextService.status),
                });
            });

        return actions.sort((a, b) => a.queueName.localeCompare(b.queueName));
    }, [selectedShopServices]);
    const newTaskCount = selectedShopTasks.length;
    const newServiceActionCount = selectedShopServiceActions.length;

    function handleShopTaskAction(task: ShopTask) {
        setManagerActionMessage(null);
        setTaskModal(task);
    }

    function handleServiceAction(action: ShopServiceAction) {
        setServiceActionMessage(null);
        setServiceModal(action);
    }

    async function confirmShopTaskAction() {
        if (!taskModal) return;
        if (!accessToken) {
            setManagerActionMessage({ type: "error", text: "Sessao invalida para executar a tarefa." });
            return;
        }

        const task = taskModal;
        const endpoint =
            task.kind === "refund"
                ? `${API_BASE}/services/${task.serviceId}/confirm-refund/`
                : `${API_BASE}/services/${task.serviceId}/confirm-manual-payment/`;

        setManagerActionId(task.id);
        setManagerActionMessage(null);

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || `Falha ao concluir tarefa (${response.status})`);
            }

            await Promise.all([refreshManagerData(), refreshCurrentAccount()]);
            setTaskModal(null);
            setManagerActionMessage({
                type: "success",
                text:
                    task.kind === "refund"
                        ? `Reembolso confirmado para ${task.customerName}.`
                        : `Pagamento manual confirmado e contabilizado para ${task.customerName}.`,
            });
        } catch (err) {
            setManagerActionMessage({
                type: "error",
                text: err instanceof Error ? err.message : "Falha ao executar tarefa.",
            });
        } finally {
            setManagerActionId(null);
        }
    }

    async function confirmServiceAction() {
        if (!serviceModal) return;
        if (!accessToken) {
            setServiceActionMessage({ type: "error", text: "Sessao invalida para esta acao." });
            return;
        }

        const action = serviceModal;
        const endpoint =
            action.kind === "start"
                ? `${API_BASE}/services/${action.serviceId}/start/`
                : `${API_BASE}/services/${action.serviceId}/complete/`;

        setServiceActionId(action.id);
        setServiceActionMessage(null);

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || `Falha ao atualizar servico (${response.status})`);
            }

            await Promise.all([refreshManagerData(), reloadShops()]);
            setServiceModal(null);
            setServiceActionMessage({
                type: "success",
                text:
                    action.kind === "start"
                        ? `Atendimento iniciado para ${action.customerName}.`
                        : `Atendimento concluido para ${action.customerName}.`,
            });
        } catch (err) {
            setServiceActionMessage({
                type: "error",
                text: err instanceof Error ? err.message : "Falha ao atualizar o servico.",
            });
        } finally {
            setServiceActionId(null);
        }
    }

    async function submitCatalogServiceType(event: React.FormEvent) {
        event.preventDefault();

        if (!selectedShopId) {
            setCatalogMessage({ type: "error", text: "Selecione uma barbearia antes de guardar o servico." });
            return;
        }

        const name = catalogForm.name.trim();
        const price = Number.parseFloat(catalogForm.price);
        const averageTime = normalizeTimeInput(catalogForm.averageTime);

        if (!name) {
            setCatalogMessage({ type: "error", text: "Indique o nome do servico." });
            return;
        }

        if (!Number.isFinite(price) || price < 0) {
            setCatalogMessage({ type: "error", text: "Indique um preco valido para o servico." });
            return;
        }

        setCatalogSaving(true);
        setCatalogMessage(null);

        try {
            const response = await fetch(`${API_BASE}/service-types/`, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                },
                body: JSON.stringify({
                    name,
                    price,
                    average_time: averageTime,
                    barbershop: /^\d+$/.test(selectedShopId) ? Number(selectedShopId) : selectedShopId,
                }),
            });

            if (!response.ok) {
                throw new Error(await readErrorMessage(response, `Falha ao guardar servico (${response.status})`));
            }

            const created = (await response.json()) as ApiCatalogServiceType;
            setCatalogServiceTypes((current) => [...current, created]);
            setCatalogForm({
                name: "",
                price: "",
                averageTime: "00:30",
            });
            setCatalogMessage({
                type: "success",
                text: `Servico adicionado ao catalogo de ${selectedShop?.name || "barbearia"}.`,
            });
        } catch (error) {
            setCatalogMessage({
                type: "error",
                text: error instanceof Error ? error.message : "Falha ao guardar servico.",
            });
        } finally {
            setCatalogSaving(false);
        }
    }

    function toggleEditing() {
        setProfileError("");
        if (editing) {
            setEditable(profileUser);
        }
        setEditing(!editing);
    }

    async function saveProfile() {
        if (!authUser?.id) {
            setProfileError("Utilizador invalido");
            return;
        }

        setSavingProfile(true);
        setProfileError("");

        try {
            const [firstName, ...rest] = editable.name.trim().split(" ").filter(Boolean);
            const updatedUser = await updateUser({
                first_name: firstName || editable.name.trim(),
                last_name: rest.join(" "),
                email: editable.email.trim(),
                telefone: editable.telefone === "Por definir" ? "" : editable.telefone.trim(),
                bairro: editable.bairro === "Por definir" ? "" : editable.bairro.trim(),
            });

            const nextProfile = buildProfileUser(updatedUser);

            setProfileUser(nextProfile);
            setEditable(nextProfile);
            setEditing(false);
        } catch (err) {
            setProfileError(err instanceof Error ? err.message : "Falha ao atualizar perfil");
        } finally {
            setSavingProfile(false);
        }
    }

    function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        setPhoto(url);
    }

    function submitRecharge(e: React.FormEvent) {
        e.preventDefault();
        if (transactionId.trim().length < 6) {
            setError("Insira um codigo valido");
            return;
        }
        setError("");
        setTransactionId("");
        void refreshCurrentAccount();
        alert("A recarga ainda nao esta ligada ao backend de contas.");
    }

    return (
        <div className="profile">
            <header className="profile__hero">
                <div className="profile__avatar">
                    {photo || persistedPhoto ? (
                        <img src={photo || persistedPhoto || ""} alt="Foto do perfil" />
                    ) : (
                        <span>{(profileUser.name || "U")[0]}</span>
                    )}
                    <label className="profile__upload">
                        Alterar foto
                        <input type="file" accept="image/*" onChange={onPhotoChange} />
                    </label>
                </div>
                <div className="profile__summary">
                    <h1>{profileUser.name || authUser?.email || "Utilizador"}</h1>
                    <p>{profileUser.bairro}</p>
                    <div className="profile__balance">
                        Saldo: {hasCurrentAccount ? `${balance.toLocaleString("pt-PT")} MZN` : "Sem conta corrente"}
                    </div>
                    <button className="profile__edit" onClick={toggleEditing} disabled={savingProfile}>
                        {editing ? "Cancelar" : "Editar dados"}
                    </button>
                    {profileError && <div className="profile__error">{profileError}</div>}
                </div>
                <div className="profile__details">
                    <div className="profile__role-card">
                        <span className="profile__role-card-inline">
                            <strong className="profile__role-card-label">Perfil:</strong>
                            <span className="profile__role-card-value">{roleLabel}</span>
                        </span>
                    </div>
                    {[
                        { label: "Nome completo", key: "name", type: "text", editable: true },
                        { label: "Bairro de residencia", key: "bairro", type: "text", editable: true },
                        { label: "Telefone", key: "telefone", type: "text", editable: true },
                        { label: "Email", key: "email", type: "email", editable: true },
                    ].map((field) => {
                        const value = editable[field.key as keyof typeof editable] as string;

                        return editing && field.editable ? (
                            <label key={field.key} className="profile__detail">
                                <span className="profile__detail-label">{field.label}</span>
                                <input
                                    type={field.type}
                                    value={value}
                                    onChange={(e) => setEditable({ ...editable, [field.key]: e.target.value })}
                                />
                                {field.key === "bairro" && (
                                    <button
                                        type="button"
                                        className="profile__save profile__save--inline profile__detail-action"
                                        onClick={saveProfile}
                                        disabled={savingProfile}
                                    >
                                        Guardar alteracoes
                                    </button>
                                )}
                            </label>
                        ) : (
                            <div key={field.key} className="profile__detail">
                                <span className="profile__detail-label">{field.label}</span>
                                <strong className="profile__detail-value">
                                    {profileUser[field.key as keyof typeof profileUser] as string}
                                </strong>
                            </div>
                        );
                    })}
                </div>
            </header>

            {canManageShop && (
                <section className="profile__card profile__card--dash">
                    <div className="profile__dashboard-header">
                        <div className="profile__dashboard-title">
                            <h2 className="profile__section-title">Dashboard</h2>
                            <input
                                type="date"
                                className="profile__dashboard-select"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                aria-label="Selecionar data"
                            />
                        </div>
                        <div className="profile__dashboard-filters">
                            <select
                                className="profile__dashboard-select"
                                value={selectedShopId}
                                onChange={(e) => setSelectedShopId(e.target.value)}
                                disabled={!adminShops.length}
                            >
                                {adminShops.map((shop) => (
                                    <option key={shop.id} value={shop.id}>
                                        {shop.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {shopsLoading ? (
                        <p className="profile__muted">A carregar barbearias...</p>
                    ) : !adminShops.length ? (
                        <p className="profile__muted">{shopsError || "Nenhuma barbearia disponivel para este utilizador."}</p>
                    ) : (
                        <div className="profile__dashboard">
                            {adminStats.map((stat) => {
                                const isClientes = stat.breakdown === "clients" && clientTrend.length > 0;
                                const isRealized = stat.breakdown === "realized" && realizedTrend.length > 0;
                                const isTempo = stat.breakdown === "wait" && queueWaits.length > 0;
                                const isFilas = stat.breakdown === "queues" && selectedShop?.queues.length;
                                const isCash = stat.breakdown === "cash";
                                const isTips = stat.breakdown === "tips";
                                const trendMax = Math.max(...clientTrend.map((item) => item.count), 1);
                                const trendPoints = clientTrend
                                    .map((item, index) => {
                                        const x = clientTrend.length === 1 ? 108 : (index / (clientTrend.length - 1)) * 216;
                                        const y = 72 - (item.count / trendMax) * 56;
                                        return `${x},${y}`;
                                    })
                                    .join(" ");
                                const realizedTrendMax = Math.max(...realizedTrend.map((item) => item.amount), 1);
                                const realizedTrendPoints = realizedTrend
                                    .map((item, index) => {
                                        const x = realizedTrend.length === 1 ? 108 : (index / (realizedTrend.length - 1)) * 216;
                                        const y = 72 - (item.amount / realizedTrendMax) * 56;
                                        return `${x},${y}`;
                                    })
                                    .join(" ");
                                const paymentMethodAmountMax = Math.max(
                                    ...paymentMethodAmountTrend.flatMap((item) => [item.accountAmount, item.cashAmount]),
                                    1
                                );
                                const paymentMixAccountPoints = paymentMethodAmountTrend
                                    .map((item, index) => {
                                        const x =
                                            paymentMethodAmountTrend.length === 1
                                                ? 108
                                                : (index / (paymentMethodAmountTrend.length - 1)) * 216;
                                        const y = 72 - (item.accountAmount / paymentMethodAmountMax) * 56;
                                        return `${x},${y}`;
                                    })
                                    .join(" ");
                                const paymentMixCashPoints = paymentMethodAmountTrend
                                    .map((item, index) => {
                                        const x =
                                            paymentMethodAmountTrend.length === 1
                                                ? 108
                                                : (index / (paymentMethodAmountTrend.length - 1)) * 216;
                                        const y = 72 - (item.cashAmount / paymentMethodAmountMax) * 56;
                                        return `${x},${y}`;
                                    })
                                    .join(" ");
                                return (
                                    <div
                                        key={stat.label}
                                        className={`profile__stat${
                                            isClientes || isRealized || isTempo || isFilas || isCash || isTips ? " profile__stat--with-breakdown" : ""
                                        }`}
                                    >
                                        <div className="profile__stat-top">
                                            <div className="profile__stat-heading">
                                                <p>{stat.label}</p>
                                                <div className="profile__stat-controls">
                                                    {isRealized && (
                                                        <button
                                                            type="button"
                                                            className={`profile__stat-toggle profile__stat-toggle--${realizedViewMode}`}
                                                            onClick={() =>
                                                                setRealizedViewMode((current) => (current === "today" ? "week" : "today"))
                                                            }
                                                            aria-label={
                                                                realizedViewMode === "today"
                                                                    ? "Mostrar total realizado nos 7 ultimos dias"
                                                                    : "Mostrar total realizado de hoje"
                                                            }
                                                        >
                                                            <span className="profile__stat-toggle-label">Hoje</span>
                                                            <span className="profile__stat-toggle-label">Nos 7 ultimos dias</span>
                                                            <span className="profile__stat-toggle-thumb" />
                                                        </button>
                                                    )}
                                                    {isCash && (
                                                        <button
                                                            type="button"
                                                            className={`profile__stat-icon-toggle${
                                                                cashChartMode ? " profile__stat-icon-toggle--active" : ""
                                                            }`}
                                                            onClick={() => setCashChartMode((current) => !current)}
                                                            aria-pressed={cashChartMode}
                                                            aria-label={cashChartMode ? "Mostrar resumo de pagamentos em numerario" : "Mostrar grafico de montantes via conta e numerario"}
                                                        >
                                                            <span>Grafico</span>
                                                            <svg viewBox="0 0 16 16" aria-hidden="true">
                                                                <path d="M2 12.5h12" />
                                                                <path d="M3 10l3-3 2 2 4-5" />
                                                                <circle cx="3" cy="10" r="1" />
                                                                <circle cx="6" cy="7" r="1" />
                                                                <circle cx="8" cy="9" r="1" />
                                                                <circle cx="12" cy="4" r="1" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {(!isRealized || realizedViewMode === "today") && (
                                                <>
                                                    <strong>{stat.value}</strong>
                                                    <span>{stat.hint}</span>
                                                </>
                                            )}
                                            {(!isRealized || realizedViewMode === "today") && stat.secondaryValue && (
                                                <div className="profile__stat-secondary">
                                                    {stat.secondaryLabel ? <p>{stat.secondaryLabel}</p> : null}
                                                    <strong>{stat.secondaryValue}</strong>
                                                    {stat.secondaryHint ? <span>{stat.secondaryHint}</span> : null}
                                                </div>
                                            )}
                                        </div>
                                        {isClientes && (
                                            <div className="profile__stat-breakdown">
                                                <div className="profile__trend">
                                                    <svg viewBox="0 0 216 80" className="profile__trend-chart" aria-hidden="true">
                                                        <path d="M0 72H216" className="profile__trend-axis" />
                                                        <polyline points={trendPoints} className="profile__trend-line" />
                                                        {clientTrend.map((item, index) => {
                                                            const x = clientTrend.length === 1 ? 108 : (index / (clientTrend.length - 1)) * 216;
                                                            const y = 72 - (item.count / trendMax) * 56;
                                                            return (
                                                                <circle
                                                                    key={item.dateKey}
                                                                    cx={x}
                                                                    cy={y}
                                                                    r="3.5"
                                                                    className="profile__trend-dot"
                                                                />
                                                            );
                                                        })}
                                                    </svg>
                                                    <div className="profile__trend-labels">
                                                        {clientTrend.map((item) => (
                                                            <div key={item.dateKey} className="profile__trend-label">
                                                                <span>{item.label}</span>
                                                                <strong>{item.count}</strong>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {isRealized && realizedViewMode === "week" && (
                                            <div className="profile__stat-breakdown">
                                                <div className="profile__trend">
                                                    <svg viewBox="0 0 216 80" className="profile__trend-chart" aria-hidden="true">
                                                        <path d="M0 72H216" className="profile__trend-axis" />
                                                        <polyline points={realizedTrendPoints} className="profile__trend-line" />
                                                        {realizedTrend.map((item, index) => {
                                                            const x =
                                                                realizedTrend.length === 1
                                                                    ? 108
                                                                    : (index / (realizedTrend.length - 1)) * 216;
                                                            const y = 72 - (item.amount / realizedTrendMax) * 56;
                                                            return (
                                                                <circle
                                                                    key={item.dateKey}
                                                                    cx={x}
                                                                    cy={y}
                                                                    r="3.5"
                                                                    className="profile__trend-dot"
                                                                />
                                                            );
                                                        })}
                                                    </svg>
                                                    <div className="profile__trend-labels">
                                                        {realizedTrend.map((item) => (
                                                            <div key={item.dateKey} className="profile__trend-label">
                                                                <span>{item.label}</span>
                                                                <strong>{item.amount.toLocaleString("pt-PT")} MZN</strong>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {isTempo && (
                                            <div className="profile__stat-breakdown profile__stat-breakdown--row">
                                                <select
                                                    className="profile__stat-select"
                                                    value={waitType}
                                                    onChange={(e) => setWaitType(e.target.value)}
                                                >
                                                    {WAIT_TYPES.map((type) => (
                                                        <option key={type} value={type}>
                                                            {type}
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="profile__stat-chips">
                                                    {queueWaits.map((item) => (
                                                        <div key={item.name} className="profile__stat-chiprow">
                                                            <span className="profile__stat-queue">{item.name}</span>
                                                            <span className="profile__stat-chip">{item.wait}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {isFilas && selectedShop && (
                                            <div className="profile__stat-breakdown profile__stat-breakdown--row">
                                                <div className="profile__stat-chips profile__stat-chips--wide">
                                                    {selectedShop.queues.map((queue, idx) => {
                                                        const hasPause = queue.status === "paused";
                                                        const openTime = idx === 0 ? "09h00" : "09h30";
                                                        const closeTime = idx === 0 ? "20h30" : "21h00";
                                                        const pauseCount = hasPause ? "Em pausa" : "5";
                                                        return (
                                                            <div key={queue.id} className="profile__stat-chiprow profile__stat-chiprow--wide">
                                                                <div className="profile__stat-queue-col">
                                                                    <span className="profile__stat-queue">{queue.name}</span>
                                                                    <small className="profile__stat-sub">
                                                                        {queue.status === "paused"
                                                                            ? "Pausada"
                                                                            : queue.status === "closed"
                                                                              ? "Fechada"
                                                                              : queue.status === "inactive"
                                                                                ? "Nao iniciada"
                                                                              : "Aberta"}
                                                                    </small>
                                                                </div>
                                                                <div className="profile__stat-meta profile__stat-meta--inline">
                                                                    <span className="profile__stat-chip">Abriu: {openTime}</span>
                                                                    <span className="profile__stat-chip">Fechou: {closeTime}</span>
                                                                    <span
                                                                        className={`profile__stat-chip${
                                                                            hasPause ? " profile__stat-chip--alert" : ""
                                                                        }`}
                                                                    >
                                                                        Pausas: {pauseCount}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                        {isCash && (
                                            <div className="profile__stat-breakdown profile__stat-breakdown--row">
                                                {cashChartMode ? (
                                                    <div className="profile__trend">
                                                        <div className="profile__trend-legend">
                                                            <span className="profile__trend-legend-item">
                                                                <span className="profile__trend-swatch profile__trend-swatch--account" />
                                                                Via conta
                                                            </span>
                                                            <span className="profile__trend-legend-item">
                                                                <span className="profile__trend-swatch profile__trend-swatch--cash" />
                                                                Numerario
                                                            </span>
                                                        </div>
                                                        <svg viewBox="0 0 216 80" className="profile__trend-chart" aria-hidden="true">
                                                            <path d="M0 72H216" className="profile__trend-axis" />
                                                            <polyline
                                                                points={paymentMixAccountPoints}
                                                                className="profile__trend-line profile__trend-line--account"
                                                            />
                                                            <polyline
                                                                points={paymentMixCashPoints}
                                                                className="profile__trend-line profile__trend-line--cash"
                                                            />
                                                            {paymentMethodAmountTrend.map((item, index) => {
                                                                const x =
                                                                    paymentMethodAmountTrend.length === 1
                                                                        ? 108
                                                                        : (index / (paymentMethodAmountTrend.length - 1)) * 216;
                                                                const accountY = 72 - (item.accountAmount / paymentMethodAmountMax) * 56;
                                                                const cashY = 72 - (item.cashAmount / paymentMethodAmountMax) * 56;
                                                                return (
                                                                    <g key={item.dateKey}>
                                                                        <circle
                                                                            cx={x}
                                                                            cy={accountY}
                                                                            r="3.5"
                                                                            className="profile__trend-dot profile__trend-dot--account"
                                                                        />
                                                                        <circle
                                                                            cx={x}
                                                                            cy={cashY}
                                                                            r="3.5"
                                                                            className="profile__trend-dot profile__trend-dot--cash"
                                                                        />
                                                                    </g>
                                                                );
                                                            })}
                                                        </svg>
                                                        <div className="profile__trend-labels">
                                                            {paymentMethodAmountTrend.map((item) => (
                                                                <div key={item.dateKey} className="profile__trend-label">
                                                                    <span>{item.label}</span>
                                                                    <strong>
                                                                        {item.accountAmount.toLocaleString("pt-PT")} / {item.cashAmount.toLocaleString("pt-PT")} MZN
                                                                    </strong>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="profile__stat-chips profile__stat-chips--wide">
                                                        <div className="profile__stat-chiprow profile__stat-chiprow--wide">
                                                            <div className="profile__stat-queue-col">
                                                                <span className="profile__stat-queue">Pendentes</span>
                                                                <small className="profile__stat-sub">
                                                                    {manualPendingServices.length} pagamento(s) por confirmar
                                                                </small>
                                                            </div>
                                                            <span className="profile__stat-chip">
                                                                {manualPendingAmount.toLocaleString("pt-PT")} MZN
                                                            </span>
                                                        </div>
                                                        <div className="profile__stat-chiprow profile__stat-chiprow--wide">
                                                            <div className="profile__stat-queue-col">
                                                                <span className="profile__stat-queue">Confirmados</span>
                                                                <small className="profile__stat-sub">
                                                                    {manualConfirmedServices.length} pagamento(s) registados
                                                                </small>
                                                            </div>
                                                            <span className="profile__stat-chip">
                                                                {manualConfirmedAmount.toLocaleString("pt-PT")} MZN
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {isTips && (
                                            <div className="profile__stat-breakdown profile__stat-breakdown--row">
                                                {selectedShopTipBreakdown.length > 0 ? (
                                                    <div className="profile__stat-chips profile__stat-chips--wide">
                                                        {selectedShopTipBreakdown.map((item) => (
                                                            <div
                                                                key={item.name}
                                                                className="profile__stat-chiprow profile__stat-chiprow--wide"
                                                            >
                                                                <div className="profile__stat-queue-col">
                                                                    <span className="profile__stat-queue">{item.name}</span>
                                                                    <small className="profile__stat-sub">
                                                                        {item.count} gorjeta(s)
                                                                    </small>
                                                                </div>
                                                                <span className="profile__stat-chip">
                                                                    {item.amount.toLocaleString("pt-PT")} MZN
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="profile__muted">Sem gorjetas contabilizadas nesta barbearia.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            )}

            {canManageShop && (
                <section className="profile__card">
                    <div className="profile__card-header">
                        <h2 className="profile__section-title">Gestao da barbearia</h2>
                        {canManageFinancials ? (
                            <div className="profile__shop-balance">
                                <span className="profile__shop-balance-label">Saldo</span>
                                <strong className="profile__shop-balance-value">{selectedShopBalanceLabel}</strong>
                            </div>
                        ) : null}
                    </div>
                    {shopsLoading ? (
                        <p className="profile__muted">A carregar barbearias...</p>
                    ) : !adminShops.length ? (
                        <p className="profile__muted">{shopsError || "Nenhuma barbearia disponivel para este utilizador."}</p>
                    ) : (
                        <>
                            <div className="profile__shop-management">
                                <div className="profile__shop-details-pane">
                                    {canManageCatalog ? (
                                        <>
                                            <div className="profile__form profile__form--stacked">
                                                <label>
                                                    Selecione a barbearia
                                                    <select value={selectedShopId} onChange={(e) => setSelectedShopId(e.target.value)}>
                                                        {adminShops.map((shop) => (
                                                            <option key={shop.id} value={shop.id}>
                                                                {shop.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>
                                                <label>
                                                    Nome comercial
                                                    <input
                                                        value={shopDraft.name}
                                                        onChange={(e) => setShopDraft((prev) => ({ ...prev, name: e.target.value }))}
                                                    />
                                                </label>
                                                <label>
                                                    Localizacao
                                                    <input
                                                        value={shopDraft.location}
                                                        onChange={(e) => setShopDraft((prev) => ({ ...prev, location: e.target.value }))}
                                                    />
                                                </label>
                                                <label>
                                                    Descricao
                                                    <textarea
                                                        value={shopDraft.description}
                                                        onChange={(e) => setShopDraft((prev) => ({ ...prev, description: e.target.value }))}
                                                        rows={3}
                                                        className="profile__textarea"
                                                    />
                                                </label>
                                            </div>
                                            <button
                                                type="button"
                                                className="profile__save"
                                                onClick={() => window.alert?.("Detalhes da barbearia atualizados (demo).")}
                                            >
                                                Guardar detalhes
                                            </button>
                                        </>
                                    ) : (
                                        <div className="profile__form profile__form--stacked">
                                            <label>
                                                Selecione a barbearia
                                                <select value={selectedShopId} onChange={(e) => setSelectedShopId(e.target.value)}>
                                                    {adminShops.map((shop) => (
                                                        <option key={shop.id} value={shop.id}>
                                                            {shop.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                            <div className="profile__task-item">
                                                <div className="profile__task-head">
                                                    <div>
                                                        <strong>{selectedShop?.name || "Barbearia"}</strong>
                                                        <span>Area operacional</span>
                                                    </div>
                                                    <span className="profile__task-state">Atendimento</span>
                                                </div>
                                                <p>{selectedShop?.location || "Localizacao nao definida."}</p>
                                                <div className="profile__task-meta">
                                                    <span>{selectedShop?.description || "Sem descricao adicional."}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="profile__shop-actions-pane">
                                    <div className="profile__action-grid">
                                        {([
                                            canManageExecution
                                                ? {
                                                      panel: "service",
                                                      title: "Atendimento",
                                                      subtitle: "Iniciar e concluir servicos",
                                                      badge: newServiceActionCount,
                                                  }
                                                : null,
                                            canManageCatalog
                                                ? {
                                                      panel: "catalog",
                                                      title: "Catalogo",
                                                      subtitle: "Inserir e atualizar servicos",
                                                  }
                                                : null,
                                            canManageFinancials
                                                ? {
                                                      panel: "tasks",
                                                      title: "Tarefas",
                                                      subtitle: "Validar pagamentos e reembolsos",
                                                      badge: newTaskCount,
                                                  }
                                                : null,
                                        ].filter(Boolean) as Array<{
                                            panel: ShopActionPanel;
                                            title: string;
                                            subtitle: string;
                                            badge?: number;
                                        }>).map((tile) => (
                                            <button
                                                key={tile.panel}
                                                type="button"
                                                className={`profile__action-tile${
                                                    shopPanelModal === tile.panel ? " profile__action-tile--active" : ""
                                                }`}
                                                onClick={() => setShopPanelModal(tile.panel)}
                                            >
                                                <span className="profile__action-icon">
                                                    <ActionTileIcon panel={tile.panel} />
                                                </span>
                                                {tile.badge ? <span className="profile__action-badge">{tile.badge}</span> : null}
                                                <strong>{tile.title}</strong>
                                                <small>{tile.subtitle}</small>
                                            </button>
                                        ))}
                                    </div>

                                </div>
                            </div>
                        </>
                    )}
                </section>
            )}

            <section className="profile__card">
                <h2 className="profile__section-title">Recarregar conta</h2>
                <div className="profile__wallets">
                    {(Object.keys(WALLET_DETAILS) as Wallet[]).map((type) => (
                        <button
                            key={type}
                            className={`profile__wallet profile__wallet--${type} ${
                                wallet === type ? "profile__wallet--active" : ""
                            }`}
                            onClick={() => setWallet(type)}
                            type="button"
                            aria-label={WALLET_DETAILS[type].label}
                        >
                            <img src={WALLET_DETAILS[type].logo} alt="" />
                            <span className="profile__wallet-name">{WALLET_DETAILS[type].label}</span>
                        </button>
                    ))}
                </div>
                <form className="profile__recharge" onSubmit={submitRecharge}>
                    <label>
                        Codigo da transacao
                        <input
                            value={transactionId}
                            onChange={(e) => setTransactionId(e.target.value)}
                            placeholder="insira o codigo da transacao"
                        />
                    </label>
                    {error && <div className="profile__error">{error}</div>}
                    <button type="submit" className="profile__save">
                        Validar e carregar
                    </button>
                </form>
            </section>

            {canManageShop && shopPanelModal ? (
                <div className="profile__panel-modal-backdrop" onClick={() => setShopPanelModal(null)}>
                    <div className="profile__panel-modal" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            className="profile__panel-modal-close"
                            onClick={() => setShopPanelModal(null)}
                            aria-label="Fechar"
                        >
                            ×
                        </button>
                        <div className="profile__panel-modal-header">
                            <div>
                                <span className="profile__panel-modal-kicker">Gestao da barbearia</span>
                                <h3>
                                    {shopPanelModal === "catalog"
                                        ? "Catalogo de servicos"
                                        : shopPanelModal === "tasks"
                                          ? "Lista de tarefas"
                                          : "Area de atendimento"}
                                </h3>
                                <p className="profile__muted">
                                    {shopPanelModal === "catalog"
                                        ? "Edite os servicos disponiveis para a barbearia selecionada."
                                        : shopPanelModal === "tasks"
                                          ? "Valide pagamentos manuais e reembolsos desta barbearia."
                                          : "Inicie e conclua atendimentos para os clientes em fila."}
                                </p>
                            </div>
                            <div className="profile__panel-modal-tabs">
                                {canManageExecution ? (
                                    <button
                                        type="button"
                                        className={`profile__panel-modal-tab${
                                            shopPanelModal === "service" ? " profile__panel-modal-tab--active" : ""
                                        }`}
                                        onClick={() => setShopPanelModal("service")}
                                    >
                                        Atendimento
                                        {newServiceActionCount ? (
                                            <span className="profile__panel-modal-tab-badge">{newServiceActionCount}</span>
                                        ) : null}
                                    </button>
                                ) : null}
                                {canManageCatalog ? (
                                    <button
                                        type="button"
                                        className={`profile__panel-modal-tab${
                                            shopPanelModal === "catalog" ? " profile__panel-modal-tab--active" : ""
                                        }`}
                                        onClick={() => setShopPanelModal("catalog")}
                                    >
                                        Catalogo
                                    </button>
                                ) : null}
                                {canManageFinancials ? (
                                    <button
                                        type="button"
                                        className={`profile__panel-modal-tab${
                                            shopPanelModal === "tasks" ? " profile__panel-modal-tab--active" : ""
                                        }`}
                                        onClick={() => setShopPanelModal("tasks")}
                                    >
                                        Tarefas
                                        {newTaskCount ? <span className="profile__panel-modal-tab-badge">{newTaskCount}</span> : null}
                                    </button>
                                ) : null}
                            </div>
                        </div>

                        {shopPanelModal === "service" ? (
                            <div className="profile__service-panel">
                                {serviceActionMessage ? (
                                    <div
                                        className={`profile__task-message${
                                            serviceActionMessage.type === "error"
                                                ? " profile__task-message--error"
                                                : " profile__task-message--success"
                                        }`}
                                    >
                                        {serviceActionMessage.text}
                                    </div>
                                ) : null}
                                {managerDataLoading ? (
                                    <p className="profile__muted">A carregar atendimentos...</p>
                                ) : managerDataError ? (
                                    <p className="profile__muted">{managerDataError}</p>
                                ) : !selectedShopServiceActions.length ? (
                                    <p className="profile__muted">Sem acoes de atendimento pendentes para esta barbearia.</p>
                                ) : (
                                    <div className="profile__service-list">
                                        {selectedShopServiceActions.map((action) => (
                                            <article key={action.id} className="profile__service-item">
                                                <div className="profile__service-head">
                                                    <div>
                                                        <strong>{action.title}</strong>
                                                        <span>{action.queueName}</span>
                                                    </div>
                                                    <span
                                                        className={`profile__service-status${
                                                            action.kind === "complete"
                                                                ? " profile__service-status--active"
                                                                : " profile__service-status--queued"
                                                        }`}
                                                    >
                                                        {action.statusLabel}
                                                    </span>
                                                </div>
                                                <p>{action.detail}</p>
                                                <div className="profile__task-meta">
                                                    <span>Cliente: {action.customerName}</span>
                                                    <span>Servico: {action.serviceName}</span>
                                                    <span>Momento: {action.createdLabel}</span>
                                                </div>
                                                <div className="profile__task-actions">
                                                    <button
                                                        type="button"
                                                        className="profile__save"
                                                        onClick={() => handleServiceAction(action)}
                                                        disabled={serviceActionId === action.id}
                                                    >
                                                        {serviceActionId === action.id ? "A processar..." : action.actionLabel}
                                                    </button>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : shopPanelModal === "catalog" ? (
                            <div className="profile__catalog profile__catalog--modal">
                                {catalogMessage ? (
                                    <div
                                        className={`profile__task-message${
                                            catalogMessage.type === "error"
                                                ? " profile__task-message--error"
                                                : " profile__task-message--success"
                                        }`}
                                    >
                                        {catalogMessage.text}
                                    </div>
                                ) : null}

                                <div className="profile__catalog-header">
                                    <div>
                                        <strong>{selectedShop?.name || "Barbearia nao selecionada"}</strong>
                                        <p className="profile__muted">
                                            Os servicos guardados aqui ficam associados a barbearia atualmente selecionada.
                                        </p>
                                    </div>
                                    <span className="profile__stat-chip">
                                        {selectedCatalogServices.length} servico(s)
                                    </span>
                                </div>

                                <div className="profile__catalog-layout">
                                    <div className="profile__catalog-list">
                                        {catalogLoading ? (
                                            <p className="profile__muted">A carregar catalogo...</p>
                                        ) : catalogError ? (
                                            <p className="profile__muted">{catalogError}</p>
                                        ) : selectedCatalogServices.length ? (
                                            selectedCatalogServices.map((item) => (
                                                <article key={item.id} className="profile__catalog-item profile__catalog-item--service">
                                                    <div className="profile__catalog-service-top">
                                                        <strong>{item.name?.trim() || `Servico #${item.id}`}</strong>
                                                        <span className="profile__stat-chip">{formatCatalogPrice(item.price)}</span>
                                                    </div>
                                                    <div className="profile__catalog-service-meta">
                                                        <span>Tempo medio: {formatAverageTimeLabel(item.average_time)}</span>
                                                        <span>ID: {item.id}</span>
                                                    </div>
                                                </article>
                                            ))
                                        ) : (
                                            <p className="profile__muted">Nenhum servico cadastrado ainda para esta barbearia.</p>
                                        )}
                                    </div>

                                    <form className="profile__catalog-form" onSubmit={submitCatalogServiceType}>
                                        <div className="profile__catalog-form-head">
                                            <strong>Novo servico</strong>
                                            <span>O servico sera guardado em {selectedShop?.name || "..."}</span>
                                        </div>

                                        <div className="profile__catalog-fields profile__catalog-fields--form">
                                            <label>
                                                Nome do servico
                                                <input
                                                    value={catalogForm.name}
                                                    onChange={(event) =>
                                                        setCatalogForm((current) => ({ ...current, name: event.target.value }))
                                                    }
                                                    placeholder="Ex.: Corte classico"
                                                />
                                            </label>
                                            <label>
                                                Preco (MZN)
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={catalogForm.price}
                                                    onChange={(event) =>
                                                        setCatalogForm((current) => ({ ...current, price: event.target.value }))
                                                    }
                                                    placeholder="0"
                                                />
                                            </label>
                                            <label>
                                                Tempo medio
                                                <input
                                                    type="time"
                                                    step="60"
                                                    value={catalogForm.averageTime}
                                                    onChange={(event) =>
                                                        setCatalogForm((current) => ({ ...current, averageTime: event.target.value }))
                                                    }
                                                />
                                            </label>
                                            <label>
                                                Barbearia
                                                <input value={selectedShop?.name || ""} readOnly />
                                            </label>
                                        </div>

                                        <div className="profile__catalog-actions">
                                            <button
                                                type="button"
                                                className="profile__save profile__save--ghost"
                                                onClick={() =>
                                                    setCatalogForm({
                                                        name: "",
                                                        price: "",
                                                        averageTime: "00:30",
                                                    })
                                                }
                                                disabled={catalogSaving}
                                            >
                                                Limpar
                                            </button>
                                            <button type="submit" className="profile__save" disabled={catalogSaving || !selectedShopId}>
                                                {catalogSaving ? "A guardar..." : "Guardar servico"}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        ) : (
                            <div className="profile__tasks-panel profile__tasks-panel--modal">
                                {managerActionMessage ? (
                                    <div
                                        className={`profile__task-message${
                                            managerActionMessage.type === "error"
                                                ? " profile__task-message--error"
                                                : " profile__task-message--success"
                                        }`}
                                    >
                                        {managerActionMessage.text}
                                    </div>
                                ) : null}
                                {managerDataLoading ? (
                                    <p className="profile__muted">A carregar tarefas...</p>
                                ) : managerDataError ? (
                                    <p className="profile__muted">{managerDataError}</p>
                                ) : !selectedShopHasCurrentAccount ? (
                                    <p className="profile__muted">A barbearia precisa de conta corrente ativa para receber tarefas financeiras.</p>
                                ) : !selectedShopTasks.length ? (
                                    <p className="profile__muted">Nenhuma tarefa pendente para esta barbearia.</p>
                                ) : (
                                    <div className="profile__task-list">
                                        {selectedShopTasks.map((task) => (
                                            <article key={task.id} className="profile__task-item">
                                                <div className="profile__task-head">
                                                    <div>
                                                        <strong>{task.title}</strong>
                                                        <span>{task.createdLabel}</span>
                                                    </div>
                                                    <span className="profile__task-state">Nova</span>
                                                </div>
                                                <p>{task.detail}</p>
                                                <div className="profile__task-meta">
                                                    <span>Cliente: {task.customerName}</span>
                                                    <span>Servico: {task.serviceName}</span>
                                                    <span>Valor: {task.amountLabel}</span>
                                                </div>
                                                <div className="profile__task-actions">
                                                    <button
                                                        type="button"
                                                        className="profile__save"
                                                        onClick={() => handleShopTaskAction(task)}
                                                        disabled={managerActionId === task.id}
                                                    >
                                                        {managerActionId === task.id ? "A processar..." : task.actionLabel}
                                                    </button>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ) : null}

            {serviceModal ? (
                <div className="profile__task-modal-backdrop" onClick={() => (serviceActionId ? undefined : setServiceModal(null))}>
                    <div className="profile__task-modal" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            className="profile__task-modal-close"
                            onClick={() => setServiceModal(null)}
                            disabled={Boolean(serviceActionId)}
                            aria-label="Fechar"
                        >
                            Ã—
                        </button>
                        <div className="profile__task-modal-header">
                            <span className="profile__task-modal-kicker">
                                {serviceModal.kind === "start" ? "Iniciar atendimento" : "Concluir atendimento"}
                            </span>
                            <h3>{serviceModal.title}</h3>
                            <p>{serviceModal.detail}</p>
                        </div>
                        <div className="profile__task-modal-grid">
                            <div className="profile__task-modal-item">
                                <span>Fila</span>
                                <strong>{serviceModal.queueName}</strong>
                            </div>
                            <div className="profile__task-modal-item">
                                <span>Estado</span>
                                <strong>{serviceModal.statusLabel}</strong>
                            </div>
                            <div className="profile__task-modal-item">
                                <span>Cliente</span>
                                <strong>{serviceModal.customerName}</strong>
                            </div>
                            <div className="profile__task-modal-item">
                                <span>Servico</span>
                                <strong>{serviceModal.serviceName}</strong>
                            </div>
                        </div>
                        <div className="profile__task-modal-note">
                            {serviceModal.kind === "start"
                                ? "Ao confirmar, o atendimento sera iniciado e a fila desta barbearia sera atualizada."
                                : "Ao confirmar, o atendimento sera concluido e o servico deixara de contar como ativo na fila."}
                        </div>
                        <div className="profile__task-modal-actions">
                            <button
                                type="button"
                                className="profile__save profile__save--ghost"
                                onClick={() => setServiceModal(null)}
                                disabled={Boolean(serviceActionId)}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="profile__save"
                                onClick={confirmServiceAction}
                                disabled={serviceActionId === serviceModal.id}
                            >
                                {serviceActionId === serviceModal.id ? "A processar..." : serviceModal.actionLabel}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {taskModal ? (
                <div className="profile__task-modal-backdrop" onClick={() => (managerActionId ? undefined : setTaskModal(null))}>
                    <div className="profile__task-modal" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            className="profile__task-modal-close"
                            onClick={() => setTaskModal(null)}
                            disabled={Boolean(managerActionId)}
                            aria-label="Fechar"
                        >
                            ×
                        </button>
                        <div className="profile__task-modal-header">
                            <span className="profile__task-modal-kicker">
                                {taskModal.kind === "refund" ? "Reembolso" : "Pagamento manual"}
                            </span>
                            <h3>{taskModal.title}</h3>
                            <p>{taskModal.detail}</p>
                        </div>
                        <div className="profile__task-modal-grid">
                            <div className="profile__task-modal-item">
                                <span>Cliente</span>
                                <strong>{taskModal.customerName}</strong>
                            </div>
                            <div className="profile__task-modal-item">
                                <span>Servico</span>
                                <strong>{taskModal.serviceName}</strong>
                            </div>
                            <div className="profile__task-modal-item">
                                <span>Valor</span>
                                <strong>{taskModal.amountLabel}</strong>
                            </div>
                            <div className="profile__task-modal-item">
                                <span>Registado em</span>
                                <strong>{taskModal.createdLabel}</strong>
                            </div>
                        </div>
                        <div className="profile__task-modal-note">
                            {taskModal.kind === "refund"
                                ? "Ao confirmar, o reembolso do servico sera processado na conta corrente do cliente."
                                : "Ao confirmar, o valor do servico sera creditado na conta corrente da barbearia e contabilizado no sistema, mantendo o historico de que o pagamento foi feito manualmente."}
                        </div>
                        <div className="profile__task-modal-actions">
                            <button
                                type="button"
                                className="profile__save profile__save--ghost"
                                onClick={() => setTaskModal(null)}
                                disabled={Boolean(managerActionId)}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="profile__save"
                                onClick={confirmShopTaskAction}
                                disabled={managerActionId === taskModal.id}
                            >
                                {managerActionId === taskModal.id ? "A processar..." : taskModal.actionLabel}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
