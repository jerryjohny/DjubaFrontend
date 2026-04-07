import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../authContext";
import { QueueInfo, QueueStatus, ShopInfo } from "../data/shops";
import { useShops } from "../hooks/useShops";
import { useCurrentAccount } from "../hooks/useCurrentAccount";
import { emitWorkspaceSync } from "../utils/workspaceSync";
import "./ShopPage.css";

type ApiServiceType = {
    id: number | string;
    name: string;
    average_time?: string | null;
    price?: number | string | null;
    barbershop?: { id?: number | string } | number | string | null;
};

type ServiceOption = {
    id: string;
    name: string;
    averageTime?: string;
    priceMt: number | null;
};

type JoinModalState = {
    queue: QueueInfo;
    shop: ShopInfo;
} | null;

type QueueClientState = {
    id: string;
    name: string;
    phone: string;
    avatar: string;
    isCurrentUser: boolean;
    serviceId?: string | null;
    serviceStatus?: string | null;
    serviceName?: string | null;
    serviceAverageTime?: string | null;
    position?: number | null;
    joinedQueueAt?: string | null;
    startTime?: string | null;
    finishTime?: string | null;
};

type QueueBarberOption = {
    id: string;
    name: string;
    userId: string | null;
};

type ClientModalState = {
    mode: "preview" | "self" | "manage";
    queue: QueueInfo;
    client: QueueClientState;
    clients: QueueClientState[];
} | null;

type QueueControlModalState = {
    queue: QueueInfo;
} | null;

type ApiBarberProfile = {
    id: number | string;
    user?:
        | {
              id?: number | string;
              first_name?: string | null;
              last_name?: string | null;
              username?: string | null;
              email?: string | null;
          }
        | number
        | string
        | null;
    shop?: { id?: number | string } | number | string | null;
};

type ApiServiceActionResponse = {
    status?: string | null;
    position?: number | string | null;
    start_time?: string | null;
    finish_time?: string | null;
    service_type?: {
        average_time?: string | null;
        name?: string | null;
    } | null;
};

type ServiceAutomationState = {
    phase: "complete" | "start";
    queueId: string;
    queueName: string;
    serviceId: string;
    clientName: string;
    remainingSeconds: number;
    isPaused: boolean;
};

const AUTO_START_QUEUE_STORAGE_KEY = "djuba:auto-start-queue";

const JOIN_FEE_MT = 10;

const QUEUE_STATUS_LABEL: Record<QueueStatus, string> = {
    open: "Fila aberta",
    closingSoon: "Fecha em breve",
    paused: "Fila pausada",
    closed: "Fechada",
    inactive: "Nao iniciada",
};

const CATALOG = [
    { name: "Careca", price: "300 MT" },
    { name: "Juba", price: "450 MT" },
    { name: "Punk", price: "400 MT" },
    { name: "Punk para mulheres", price: "550 MT" },
    { name: "Barba", price: "200 MT" },
];

function getNestedId(value: unknown): string | null {
    if (value == null) return null;
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (typeof value === "object" && "id" in value) {
        const nested = (value as { id?: string | number }).id;
        return nested == null ? null : String(nested);
    }
    return null;
}

function parseMoney(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string") return null;
    const numeric = value.replace(/[^\d.,]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
    const parsed = Number.parseFloat(numeric);
    return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(value: number) {
    return `${value.toLocaleString("pt-PT")} MT`;
}

function parseDurationToSeconds(value?: string | null) {
    if (!value) return null;
    const parts = value.split(":").map((part) => Number.parseInt(part, 10));
    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part) || part < 0)) {
        return null;
    }

    return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function formatCountdown(totalSeconds: number) {
    const safeSeconds = Math.max(0, totalSeconds);
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    if (hours > 0) {
        return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
    }

    return [minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function getCountdownAudioContext() {
    if (typeof window === "undefined") return null;

    const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    return AudioContextCtor ? new AudioContextCtor() : null;
}

function playTickCue(context: AudioContext, currentTime: number) {
    const primaryOscillator = context.createOscillator();
    const secondaryOscillator = context.createOscillator();
    const gainNode = context.createGain();

    primaryOscillator.type = "sawtooth";
    secondaryOscillator.type = "square";

    primaryOscillator.frequency.setValueAtTime(1420, currentTime);
    primaryOscillator.frequency.exponentialRampToValueAtTime(1180, currentTime + 0.16);
    secondaryOscillator.frequency.setValueAtTime(1480, currentTime);
    secondaryOscillator.frequency.exponentialRampToValueAtTime(1240, currentTime + 0.16);
    secondaryOscillator.detune.setValueAtTime(18, currentTime);

    gainNode.gain.setValueAtTime(0.0001, currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.16, currentTime + 0.012);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, currentTime + 0.18);

    primaryOscillator.connect(gainNode);
    secondaryOscillator.connect(gainNode);
    gainNode.connect(context.destination);

    primaryOscillator.start(currentTime);
    secondaryOscillator.start(currentTime);
    primaryOscillator.stop(currentTime + 0.18);
    secondaryOscillator.stop(currentTime + 0.18);
}

function playChimeCue(context: AudioContext, currentTime: number) {
    const firstOscillator = context.createOscillator();
    const firstGain = context.createGain();
    firstOscillator.type = "sine";
    firstOscillator.frequency.setValueAtTime(740, currentTime);
    firstOscillator.frequency.exponentialRampToValueAtTime(880, currentTime + 0.16);
    firstGain.gain.setValueAtTime(0.0001, currentTime);
    firstGain.gain.exponentialRampToValueAtTime(0.045, currentTime + 0.04);
    firstGain.gain.exponentialRampToValueAtTime(0.0001, currentTime + 0.2);
    firstOscillator.connect(firstGain);
    firstGain.connect(context.destination);
    firstOscillator.start(currentTime);
    firstOscillator.stop(currentTime + 0.22);

    const secondOscillator = context.createOscillator();
    const secondGain = context.createGain();
    secondOscillator.type = "triangle";
    secondOscillator.frequency.setValueAtTime(990, currentTime + 0.08);
    secondOscillator.frequency.exponentialRampToValueAtTime(1180, currentTime + 0.24);
    secondGain.gain.setValueAtTime(0.0001, currentTime + 0.08);
    secondGain.gain.exponentialRampToValueAtTime(0.04, currentTime + 0.12);
    secondGain.gain.exponentialRampToValueAtTime(0.0001, currentTime + 0.28);
    secondOscillator.connect(secondGain);
    secondGain.connect(context.destination);
    secondOscillator.start(currentTime + 0.08);
    secondOscillator.stop(currentTime + 0.3);
}

function getClientServiceCountdown(client?: Pick<QueueClientState, "serviceStatus" | "serviceAverageTime" | "startTime"> | null, nowMs = Date.now()) {
    if (!client || getServiceStatus(client.serviceStatus) !== "IN_SERVICE") {
        return null;
    }

    const durationSeconds = parseDurationToSeconds(client.serviceAverageTime);
    const startTimeMs = client.startTime ? Date.parse(client.startTime) : Number.NaN;

    if (!durationSeconds || !Number.isFinite(startTimeMs)) {
        return null;
    }

    const endTimeMs = startTimeMs + durationSeconds * 1000;
    const remainingMs = Math.max(0, endTimeMs - nowMs);

    return {
        durationSeconds,
        remainingSeconds: Math.ceil(remainingMs / 1000),
        completed: remainingMs <= 0,
    };
}

function formatQueueDate(value?: string | null) {
    if (!value) return null;
    const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
    if (!year || !month || !day) return value;

    return new Intl.DateTimeFormat("pt-PT", {
        timeZone: "Africa/Maputo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(new Date(Date.UTC(year, month - 1, day)));
}

function getCurrentMaputoDateKey() {
    return new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Africa/Maputo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
}

function getBarberOptionLabel(
    barber: ApiBarberProfile,
    index: number,
    authUserId?: number,
    fallbackName?: string | null
) {
    const barberUserId = getNestedId(barber.user);
    const rawUser = typeof barber.user === "object" && barber.user ? barber.user : null;
    const directName = [rawUser?.first_name?.trim(), rawUser?.last_name?.trim()].filter(Boolean).join(" ").trim();
    const fallbackUserName = rawUser?.username?.trim() || rawUser?.email?.split("@")[0]?.trim() || "";

    return (
        (barberUserId && authUserId != null && barberUserId === String(authUserId) ? "Eu" : "") ||
        directName ||
        fallbackUserName ||
        fallbackName ||
        `Barbeiro #${index + 1}`
    );
}

function toRequestId(value: string) {
    return /^\d+$/.test(value) ? Number(value) : value;
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

function parseQueuePosition(value?: number | null) {
    return typeof value === "number" && Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function compareQueueClients(left: QueueClientState, right: QueueClientState) {
    const rank = (client: QueueClientState) => {
        const status = getServiceStatus(client.serviceStatus);
        if (status === "IN_SERVICE") return 0;
        if (status === "QUEUED") return 1;
        if (status === "COMPLETED") return 2;
        return 3;
    };

    const rankDelta = rank(left) - rank(right);
    if (rankDelta !== 0) return rankDelta;

    const positionDelta = parseQueuePosition(left.position) - parseQueuePosition(right.position);
    if (Number.isFinite(positionDelta) && positionDelta !== 0) return positionDelta;

    const leftTime = left.joinedQueueAt ? Date.parse(left.joinedQueueAt) : Number.NaN;
    const rightTime = right.joinedQueueAt ? Date.parse(right.joinedQueueAt) : Number.NaN;
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
        return leftTime - rightTime;
    }

    return left.id.localeCompare(right.id);
}

function mapServiceOption(serviceType: ApiServiceType): ServiceOption {
    const catalogFallback = CATALOG.find((item) => item.name.toLowerCase() === serviceType.name.trim().toLowerCase());
    return {
        id: String(serviceType.id),
        name: serviceType.name,
        averageTime: serviceType.average_time ?? undefined,
        priceMt: parseMoney(serviceType.price) ?? parseMoney(catalogFallback?.price),
    };
}

function createQueueClients(
    queue: QueueInfo,
    authUser?: {
        id?: number;
        first_name?: string;
        last_name?: string;
        email?: string;
        telefone?: string;
        profile_picture?: string;
    }
) {
    const currentUserId = authUser?.id != null ? String(authUser.id) : null;

    return (queue.clients ?? []).map((client) => ({
        ...client,
        isCurrentUser: currentUserId != null && client.id === currentUserId,
    }));
}

export default function ShopPage() {
    const { shopId } = useParams();
    const navigate = useNavigate();
    const { user: authUser, accessToken, authFetch } = useAuth();
    const { shops, enterableShopIds, loading, reload } = useShops();
    const apiRole = String(authUser?.role ?? "").toUpperCase();
    const hasRestrictedMarketplaceAccess = apiRole === "SHOP_ADMIN" || apiRole === "BARBER";
    const canManageQueueClients = ["SYS_ADMIN", "ADMIN", "SHOP_ADMIN", "BARBER"].includes(apiRole);
    const canAssignQueueBarber = ["SYS_ADMIN", "ADMIN", "SHOP_ADMIN"].includes(apiRole);
    const { balance: accountBalance, hasCurrentAccount: userHasCurrentAccount, refresh: refreshCurrentAccount } = useCurrentAccount();
    const [catalogOpen, setCatalogOpen] = useState(false);
    const [serviceTypes, setServiceTypes] = useState<ServiceOption[]>([]);
    const [serviceTypesLoading, setServiceTypesLoading] = useState(false);
    const [serviceTypesError, setServiceTypesError] = useState<string | null>(null);
    const [joinModal, setJoinModal] = useState<JoinModalState>(null);
    const [joinStep, setJoinStep] = useState<"select" | "confirm">("select");
    const [selectedServiceId, setSelectedServiceId] = useState("");
    const [payServiceViaAccount, setPayServiceViaAccount] = useState(false);
    const [tipAmountInput, setTipAmountInput] = useState("");
    const [joinError, setJoinError] = useState("");
    const [joinSuccess, setJoinSuccess] = useState("");
    const [joining, setJoining] = useState(false);
    const [leavingQueueId, setLeavingQueueId] = useState<string | null>(null);
    const [transferringQueueId, setTransferringQueueId] = useState<string | null>(null);
    const [activeClientModal, setActiveClientModal] = useState<ClientModalState>(null);
    const [queueControlModal, setQueueControlModal] = useState<QueueControlModalState>(null);
    const [userSwapOffers, setUserSwapOffers] = useState<Record<string, boolean>>({});
    const [clientActionError, setClientActionError] = useState("");
    const [clientActionSuccess, setClientActionSuccess] = useState("");
    const [clientActionPending, setClientActionPending] = useState<string | null>(null);
    const [queueControlError, setQueueControlError] = useState("");
    const [queueControlSuccess, setQueueControlSuccess] = useState("");
    const [queueControlPending, setQueueControlPending] = useState<string | null>(null);
    const [queueBarbersLoading, setQueueBarbersLoading] = useState(false);
    const [queueBarberOptions, setQueueBarberOptions] = useState<QueueBarberOption[]>([]);
    const [selectedQueueBarberId, setSelectedQueueBarberId] = useState("");
    const [createQueueModalOpen, setCreateQueueModalOpen] = useState(false);
    const [createQueueBarberId, setCreateQueueBarberId] = useState("");
    const [createQueuePending, setCreateQueuePending] = useState(false);
    const [createQueueError, setCreateQueueError] = useState("");
    const [queueCloseNote, setQueueCloseNote] = useState("");
    const [swapTargetServiceId, setSwapTargetServiceId] = useState("");
    const queueRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const [canScrollRight, setCanScrollRight] = useState<Record<string, boolean>>({});
    const [serviceTimerTick, setServiceTimerTick] = useState(() => Date.now());
    const [serviceAutomation, setServiceAutomation] = useState<ServiceAutomationState | null>(null);
    const [serviceAutomationPending, setServiceAutomationPending] = useState<"start" | "complete" | null>(null);
    const [queuedAutoStartQueueId, setQueuedAutoStartQueueId] = useState<string | null>(() => {
        if (typeof window === "undefined") return null;
        return window.sessionStorage.getItem(AUTO_START_QUEUE_STORAGE_KEY);
    });
    const countdownAudioContextRef = useRef<AudioContext | null>(null);
    const lastCountdownCueRef = useRef<string | null>(null);

    const shop = useMemo<ShopInfo | undefined>(() => shops.find((s) => s.id === shopId), [shopId, shops]);
    const canEnterCurrentShop = useMemo(() => {
        if (!shopId) return false;
        if (!hasRestrictedMarketplaceAccess) return true;
        return enterableShopIds.includes(shopId);
    }, [enterableShopIds, hasRestrictedMarketplaceAccess, shopId]);
    const selectedService = useMemo(
        () => serviceTypes.find((item) => item.id === selectedServiceId) ?? null,
        [selectedServiceId, serviceTypes]
    );
    const currentUserQueue = useMemo(
        () => shop?.queues.find((queue) => Boolean(queue.currentUserServiceId)) ?? null,
        [shop]
    );
    const currentUserShopServiceId = currentUserQueue?.currentUserServiceId ?? null;
    const modalClients = useMemo(
        () => (activeClientModal ? [...activeClientModal.clients].sort(compareQueueClients) : []),
        [activeClientModal]
    );
    const modalActiveClient = useMemo(
        () => modalClients.find((client) => getServiceStatus(client.serviceStatus) === "IN_SERVICE") ?? null,
        [modalClients]
    );
    const modalFirstQueuedClient = useMemo(
        () => modalClients.find((client) => getServiceStatus(client.serviceStatus) === "QUEUED") ?? null,
        [modalClients]
    );
    const modalCanStartSelected =
        activeClientModal != null &&
        getServiceStatus(activeClientModal.client.serviceStatus) === "QUEUED" &&
        !modalActiveClient &&
        modalFirstQueuedClient?.serviceId === activeClientModal.client.serviceId &&
        activeClientModal.queue.status !== "paused" &&
        activeClientModal.queue.status !== "closed" &&
        activeClientModal.queue.status !== "inactive";
    const modalCanFinishSelected =
        activeClientModal != null && getServiceStatus(activeClientModal.client.serviceStatus) === "IN_SERVICE";
    const modalSwapCandidates = useMemo(
        () =>
            activeClientModal
                ? modalClients.filter(
                      (client) =>
                          client.serviceId &&
                          client.serviceId !== activeClientModal.client.serviceId &&
                          getServiceStatus(client.serviceStatus) === "QUEUED"
                  )
                : [],
        [activeClientModal, modalClients]
    );
    const modalPrimaryServiceAction = useMemo(() => {
        if (!activeClientModal) return null;

        if (modalCanFinishSelected) {
            return {
                action: "complete" as const,
                label: "Concluir atendimento",
                pendingLabel: "A concluir...",
                danger: true,
            };
        }

        if (modalCanStartSelected) {
            return {
                action: "start" as const,
                label: "Iniciar atendimento",
                pendingLabel: "A iniciar...",
                danger: false,
            };
        }

        return null;
    }, [activeClientModal, modalCanFinishSelected, modalCanStartSelected]);
    const activeServiceCountdown = useMemo(
        () => getClientServiceCountdown(activeClientModal?.client ?? null, serviceTimerTick),
        [activeClientModal, serviceTimerTick]
    );
    const expiredServiceCandidate = useMemo(() => {
        if (!shop || !canManageQueueClients || !accessToken) return null;

        for (const queue of shop.queues) {
            if (queue.status !== "open") continue;

            const clients = [...createQueueClients(queue, authUser ?? undefined)].sort(compareQueueClients);
            const activeClient = clients.find(
                (client) => client.serviceId && getServiceStatus(client.serviceStatus) === "IN_SERVICE"
            );

            if (!activeClient) continue;

            const countdown = getClientServiceCountdown(activeClient, serviceTimerTick);
            if (!countdown?.completed) continue;

            return { queue, client: activeClient };
        }

        return null;
    }, [accessToken, authUser, canManageQueueClients, serviceTimerTick, shop]);
    const queuedAutoStartCandidate = useMemo(() => {
        if (!shop || !queuedAutoStartQueueId || !canManageQueueClients || !accessToken) return null;

        const queue = shop.queues.find((item) => item.id === queuedAutoStartQueueId);
        if (!queue || queue.status !== "open") return null;

        const clients = [...createQueueClients(queue, authUser ?? undefined)].sort(compareQueueClients);
        const activeClient = clients.find((client) => getServiceStatus(client.serviceStatus) === "IN_SERVICE");
        if (activeClient) return null;

        const queuedClient = clients.find(
            (client) => client.serviceId && getServiceStatus(client.serviceStatus) === "QUEUED"
        );
        if (!queuedClient) return null;

        return { queue, client: queuedClient };
    }, [accessToken, authUser, canManageQueueClients, queuedAutoStartQueueId, shop]);
    const currentQueueBarberLabel = useMemo(() => {
        if (!queueControlModal?.queue.assignedBarberId) return "Sem barbeiro atribuido";

        return (
            queueBarberOptions.find((option) => option.id === queueControlModal.queue.assignedBarberId)?.name ||
            `Barbeiro #${queueControlModal.queue.assignedBarberId}`
        );
    }, [queueBarberOptions, queueControlModal]);
    const shopHasCurrentAccount = joinModal?.shop.hasCurrentAccount ?? shop?.hasCurrentAccount ?? true;
    const serviceCharge = payServiceViaAccount ? selectedService?.priceMt ?? 0 : 0;
    const tipAmount = parseMoney(tipAmountInput) ?? 0;
    const totalDebit = JOIN_FEE_MT + serviceCharge + tipAmount;
    const currentQueueDate = getCurrentMaputoDateKey();

    useEffect(() => {
        const interval = window.setInterval(() => {
            setServiceTimerTick(Date.now());
        }, 1000);

        return () => window.clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!shop) {
            setServiceTypes([]);
            return;
        }

        const currentShopId = shop.id;

        const controller = new AbortController();

        async function loadServiceTypes() {
            setServiceTypesLoading(true);
            setServiceTypesError(null);

            try {
                const response = await authFetch("/api/service-types/", {
                    signal: controller.signal,
                    headers: {
                        Accept: "application/json",
                    },
                });

                if (!response.ok) {
                    throw new Error(`Falha ao carregar servicos (${response.status})`);
                }

                const data = (await response.json()) as ApiServiceType[];
                const filtered = data
                    .filter((item) => getNestedId(item.barbershop) === currentShopId)
                    .map(mapServiceOption);

                setServiceTypes(filtered);
                setSelectedServiceId((current) => current || filtered[0]?.id || "");
            } catch (err) {
                if (!controller.signal.aborted) {
                    setServiceTypes([]);
                    setSelectedServiceId("");
                    setServiceTypesError(err instanceof Error ? err.message : "Falha ao carregar servicos");
                }
            } finally {
                if (!controller.signal.aborted) {
                    setServiceTypesLoading(false);
                }
            }
        }

        void loadServiceTypes();

        return () => controller.abort();
    }, [accessToken, shop]);

    useEffect(() => {
        if ((!queueControlModal && !createQueueModalOpen) || !shop) {
            setQueueBarberOptions([]);
            setQueueBarbersLoading(false);
            return;
        }

        const controller = new AbortController();
        const currentShop = shop;
        const activeQueue = queueControlModal?.queue ?? null;

        async function loadBarbers() {
            setQueueBarbersLoading(true);
            setQueueControlError("");

            try {
                const response = await authFetch(`/api/barbers/?shop=${toRequestId(currentShop.id)}`, {
                    signal: controller.signal,
                    headers: {
                        Accept: "application/json",
                    },
                });

                if (!response.ok) {
                    throw new Error(`Falha ao carregar barbeiros (${response.status})`);
                }

                const data = (await response.json()) as ApiBarberProfile[];
                if (controller.signal.aborted) return;

                const nextOptions = (Array.isArray(data) ? data : []).map((barber, index) => {
                    const barberId = String(barber.id);
                    const barberUserId = getNestedId(barber.user);
                    const fallbackName = currentShop.queues
                        .flatMap((queue) => queue.barbers)
                        .find((item) => item.id === barberId)?.name;

                    return {
                        id: barberId,
                        userId: barberUserId,
                        name: getBarberOptionLabel(barber, index, authUser?.id, fallbackName),
                    } satisfies QueueBarberOption;
                });

                setQueueBarberOptions(nextOptions);

                setSelectedQueueBarberId((current) => {
                    if (current) return current;
                    if (activeQueue?.assignedBarberId) return activeQueue.assignedBarberId;
                    if (apiRole === "BARBER") {
                        return nextOptions.find((option) => option.userId === String(authUser?.id))?.id ?? "";
                    }
                    return "";
                });

                setCreateQueueBarberId((current) => {
                    if (current) return current;
                    if (apiRole === "BARBER") {
                        return nextOptions.find((option) => option.userId === String(authUser?.id))?.id ?? "";
                    }
                    return nextOptions[0]?.id ?? "";
                });
            } catch (error) {
                if (controller.signal.aborted) return;
                setQueueBarberOptions([]);
                const message = error instanceof Error ? error.message : "Falha ao carregar barbeiros";
                setQueueControlError(message);
                setCreateQueueError(message);
            } finally {
                if (!controller.signal.aborted) {
                    setQueueBarbersLoading(false);
                }
            }
        }

        void loadBarbers();

        return () => controller.abort();
    }, [accessToken, apiRole, authUser?.id, createQueueModalOpen, queueControlModal, shop]);

    useEffect(() => {
        if (!shop) return;

        setActiveClientModal((current) => {
            if (!current) return current;

            const nextQueue = shop.queues.find((queue) => queue.id === current.queue.id);
            if (!nextQueue) return null;

            const nextClients = [...createQueueClients(nextQueue, authUser ?? undefined)].sort(compareQueueClients);
            const nextClient =
                (current.client.serviceId
                    ? nextClients.find((client) => client.serviceId === current.client.serviceId)
                    : undefined) ?? nextClients.find((client) => client.id === current.client.id);

            if (!nextClient) return null;

            return {
                ...current,
                queue: nextQueue,
                client: nextClient,
                clients: nextClients,
            };
        });
    }, [authUser, shop]);

    useEffect(() => {
        if (!expiredServiceCandidate) return;

        setServiceAutomation((current) => {
            if (current) return current;

            return {
                phase: "complete",
                queueId: expiredServiceCandidate.queue.id,
                queueName: expiredServiceCandidate.queue.name,
                serviceId: expiredServiceCandidate.client.serviceId || "",
                clientName: expiredServiceCandidate.client.name,
                remainingSeconds: 10,
                isPaused: false,
            };
        });
    }, [expiredServiceCandidate]);

    useEffect(() => {
        if (!queuedAutoStartCandidate) return;

        setServiceAutomation((current) => {
            if (current) return current;

            return {
                phase: "start",
                queueId: queuedAutoStartCandidate.queue.id,
                queueName: queuedAutoStartCandidate.queue.name,
                serviceId: queuedAutoStartCandidate.client.serviceId || "",
                clientName: queuedAutoStartCandidate.client.name,
                remainingSeconds: 10,
                isPaused: false,
            };
        });
    }, [queuedAutoStartCandidate]);

    useEffect(() => {
        setServiceAutomation((current) => {
            if (!current) return current;

            if (current.phase === "complete") {
                if (!expiredServiceCandidate || expiredServiceCandidate.client.serviceId !== current.serviceId) {
                    return null;
                }
            }

            if (current.phase === "start") {
                if (!queuedAutoStartCandidate || queuedAutoStartCandidate.client.serviceId !== current.serviceId) {
                    return null;
                }
            }

            return current;
        });
    }, [expiredServiceCandidate, queuedAutoStartCandidate]);

    useEffect(() => {
        if (!serviceAutomation || serviceAutomationPending || serviceAutomation.isPaused || serviceAutomation.remainingSeconds <= 0) return;

        const timeout = window.setTimeout(() => {
            setServiceAutomation((current) =>
                current ? { ...current, remainingSeconds: Math.max(0, current.remainingSeconds - 1) } : current
            );
        }, 1000);

        return () => window.clearTimeout(timeout);
    }, [serviceAutomation, serviceAutomationPending]);

    useEffect(() => {
        const automation = serviceAutomation;
        if (!automation || serviceAutomationPending || automation.isPaused || automation.remainingSeconds > 0 || !accessToken) return;
        const activeAutomation: ServiceAutomationState = automation;

        let cancelled = false;

        async function runAutomatedTransition() {
            setServiceAutomationPending(activeAutomation.phase);

            try {
                const endpoint =
                    activeAutomation.phase === "complete"
                        ? `/api/services/${toRequestId(activeAutomation.serviceId)}/complete/`
                        : `/api/services/${toRequestId(activeAutomation.serviceId)}/start/`;

                const response = await authFetch(endpoint, {
                    method: "POST",
                    headers: {
                        Accept: "application/json",
                    },
                });

                if (!response.ok) {
                    const text = await response.text();
                    throw new Error(
                        text || `Falha ao ${activeAutomation.phase === "complete" ? "concluir" : "iniciar"} automaticamente`
                    );
                }

                if (cancelled) return;

                if (activeAutomation.phase === "complete") {
                    setClientActionSuccess(`Atendimento concluido automaticamente para ${activeAutomation.clientName}.`);
                    if (typeof window !== "undefined") {
                        window.sessionStorage.setItem(AUTO_START_QUEUE_STORAGE_KEY, activeAutomation.queueId);
                    }
                    emitWorkspaceSync({
                        source: "shop-page:auto-complete",
                        shopId: shop?.id ?? null,
                        queueId: activeAutomation.queueId,
                        serviceId: activeAutomation.serviceId,
                    });
                    setActiveClientModal((current) =>
                        current?.client.serviceId === activeAutomation.serviceId ? null : current
                    );
                } else {
                    setClientActionSuccess(`Atendimento iniciado automaticamente para ${activeAutomation.clientName}.`);
                    if (typeof window !== "undefined") {
                        window.sessionStorage.removeItem(AUTO_START_QUEUE_STORAGE_KEY);
                    }
                    emitWorkspaceSync({
                        source: "shop-page:auto-start",
                        shopId: shop?.id ?? null,
                        queueId: activeAutomation.queueId,
                        serviceId: activeAutomation.serviceId,
                    });
                    setQueuedAutoStartQueueId(null);
                }

                setServiceAutomation(null);
                if (activeAutomation.phase === "complete" && typeof window !== "undefined") {
                    window.setTimeout(() => {
                        window.location.reload();
                    }, 80);
                    return;
                }

                reload();
            } catch (error) {
                if (cancelled) return;
                setClientActionError(
                    error instanceof Error ? error.message : "Falha ao executar a transicao automatica do atendimento"
                );
                setServiceAutomation(null);
            } finally {
                if (!cancelled) {
                    setServiceAutomationPending(null);
                }
            }
        }

        void runAutomatedTransition();

        return () => {
            cancelled = true;
        };
    }, [accessToken, reload, serviceAutomation]);

    useEffect(() => {
        if (!queuedAutoStartQueueId) return;
        if (loading) return;

        const matchingQueue = shop?.queues.find((queue) => queue.id === queuedAutoStartQueueId);
        if (!matchingQueue) {
            if (typeof window !== "undefined") {
                window.sessionStorage.removeItem(AUTO_START_QUEUE_STORAGE_KEY);
            }
            setQueuedAutoStartQueueId(null);
            return;
        }

        if (!queuedAutoStartCandidate) {
            const clients = [...createQueueClients(matchingQueue, authUser ?? undefined)].sort(compareQueueClients);
            const hasQueuedClient = clients.some((client) => getServiceStatus(client.serviceStatus) === "QUEUED");
            const hasActiveClient = clients.some((client) => getServiceStatus(client.serviceStatus) === "IN_SERVICE");

            if (!hasQueuedClient || hasActiveClient || matchingQueue.status !== "open") {
                if (typeof window !== "undefined") {
                    window.sessionStorage.removeItem(AUTO_START_QUEUE_STORAGE_KEY);
                }
                setQueuedAutoStartQueueId(null);
            }
        }
    }, [authUser, loading, queuedAutoStartCandidate, queuedAutoStartQueueId, shop]);

    useEffect(() => {
        if (!serviceAutomation || serviceAutomation.remainingSeconds <= 0) {
            lastCountdownCueRef.current = null;
            return;
        }

        const cueKey = `${serviceAutomation.phase}:${serviceAutomation.serviceId}:${serviceAutomation.remainingSeconds}`;
        if (lastCountdownCueRef.current === cueKey) {
            return;
        }
        lastCountdownCueRef.current = cueKey;

        const context =
            countdownAudioContextRef.current && countdownAudioContextRef.current.state !== "closed"
                ? countdownAudioContextRef.current
                : getCountdownAudioContext();

        if (!context) return;
        countdownAudioContextRef.current = context;

        void context.resume().then(() => {
            const now = context.currentTime;
            if (serviceAutomation.phase === "complete") {
                playTickCue(context, now);
            } else {
                playChimeCue(context, now);
            }
        }).catch(() => {
            // Ignore browsers that block autoplay until a user gesture.
        });
    }, [serviceAutomation]);

    useEffect(() => {
        return () => {
            const context = countdownAudioContextRef.current;
            countdownAudioContextRef.current = null;
            if (context && context.state !== "closed") {
                void context.close().catch(() => {
                    // Ignore close errors during teardown.
                });
            }
        };
    }, []);

    useEffect(() => {
        if (!shop) return;
        shop.queues.forEach((queue) => {
            requestAnimationFrame(() => updateArrow(queue.id));
        });
    }, [shop]);

    const updateArrow = (queueId: string) => {
        const el = queueRefs.current[queueId];
        if (!el) return;
        const hasMore = el.scrollWidth - el.clientWidth - el.scrollLeft > 6;
        setCanScrollRight((prev) => {
            if (prev[queueId] === hasMore) return prev;
            return { ...prev, [queueId]: hasMore };
        });
    };

    function openJoinModal(queue: QueueInfo) {
        if (!shop) return;
        if (queue.status !== "open") {
            setJoinError("Esta fila nao esta disponivel para novas entradas neste momento.");
            return;
        }
        setJoinModal({ queue, shop });
        setJoinStep("select");
        setJoinError("");
        setJoinSuccess("");
        setPayServiceViaAccount(false);
        setTipAmountInput("");
        setSelectedServiceId(serviceTypes[0]?.id ?? "");
    }

    function closeJoinModal() {
        if (joining) return;
        setJoinModal(null);
        setJoinStep("select");
        setJoinError("");
        setPayServiceViaAccount(false);
        setTipAmountInput("");
    }

    function openClientModal(queue: QueueInfo, client: QueueClientState, clients: QueueClientState[]) {
        setActiveClientModal({
            mode: canManageQueueClients ? "manage" : client.isCurrentUser ? "self" : "preview",
            queue,
            client,
            clients,
        });
        setClientActionError("");
        setSwapTargetServiceId("");
    }

    function closeClientModal() {
        if (leavingQueueId || clientActionPending) return;
        setActiveClientModal(null);
        setSwapTargetServiceId("");
    }

    function openQueueControlModal(queue: QueueInfo) {
        if (!canManageQueueClients) return;
        setQueueControlModal({ queue });
        setQueueControlError("");
        setQueueControlSuccess("");
        setSelectedQueueBarberId(queue.assignedBarberId || "");
        setQueueCloseNote("");
    }

    function closeQueueControlModal() {
        if (queueControlPending) return;
        setQueueControlModal(null);
        setSelectedQueueBarberId("");
        setQueueCloseNote("");
    }

    function openCreateQueueModal() {
        if (!canManageQueueClients) return;
        setCreateQueueModalOpen(true);
        setCreateQueueError("");
        setQueueControlSuccess("");
    }

    function closeCreateQueueModal() {
        if (createQueuePending) return;
        setCreateQueueModalOpen(false);
        setCreateQueueBarberId("");
        setCreateQueueError("");
    }

    function continueToConfirmation() {
        if (!selectedService) {
            setJoinError("Selecione um servico antes de continuar.");
            return;
        }

        if (!userHasCurrentAccount) {
            setJoinError("Precisa de uma conta corrente ativa para entrar na fila.");
            return;
        }

        if (payServiceViaAccount) {
            if (!shopHasCurrentAccount) {
                setJoinError("Esta barbearia ainda nao recebe servicos pela conta.");
                return;
            }

            if (!userHasCurrentAccount) {
                setJoinError("Precisa de uma conta corrente ativa para pagar o servico pela conta.");
                return;
            }

            if (selectedService.priceMt == null) {
                setJoinError("Este servico ainda nao tem preco configurado para pagamento pela conta.");
                return;
            }
        }

        if (tipAmount > 0 && !shopHasCurrentAccount) {
            setJoinError("Esta barbearia ainda nao consegue receber gorjetas pela conta.");
            return;
        }

        setJoinError("");
        setJoinStep("confirm");
    }

    async function confirmJoinQueue() {
        if (!joinModal || !selectedService || !authUser?.id || !accessToken) {
            setJoinError("Nao foi possivel validar a sua sessao.");
            return;
        }

        if ((authUser.role ?? "").toUpperCase() !== "CUSTOMER") {
            setJoinError("Apenas utilizadores com perfil de cliente podem entrar na fila.");
            return;
        }

        if (accountBalance < totalDebit) {
            setJoinError(`Saldo insuficiente. Precisa de ${formatMoney(totalDebit)} e tem ${formatMoney(accountBalance)}.`);
            return;
        }

        setJoining(true);
        setJoinError("");

        try {
            const response = await authFetch("/api/services/", {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    service_type: toRequestId(selectedService.id),
                    queue: toRequestId(joinModal.queue.id),
                    pay_service_via_account: payServiceViaAccount,
                    tip_amount: tipAmount.toFixed(2),
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || `Falha ao entrar na fila (${response.status})`);
            }
            void refreshCurrentAccount();
            setJoinSuccess(`Entrada registada na fila ${joinModal.queue.name} na posicao #${joinModal.queue.customers + 1}.`);
            setJoinModal(null);
            setJoinStep("select");
            setPayServiceViaAccount(false);
            setTipAmountInput("");
            emitWorkspaceSync({
                source: "shop-page:join",
                shopId: joinModal.shop.id,
                queueId: joinModal.queue.id,
            });
            reload();
        } catch (err) {
            setJoinError(err instanceof Error ? err.message : "Falha ao entrar na fila");
        } finally {
            setJoining(false);
        }
    }

    async function leaveQueue(queue: QueueInfo) {
        if (!queue.currentUserServiceId || !accessToken) {
            setJoinError("Nao foi possivel identificar a sua entrada nesta fila.");
            return;
        }

        setLeavingQueueId(queue.id);
        setJoinError("");
        setJoinSuccess("");

        try {
            const response = await authFetch(`/api/services/${toRequestId(queue.currentUserServiceId)}/leave/`, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                },
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || `Falha ao sair da fila (${response.status})`);
            }

            setActiveClientModal(null);
            setJoinSuccess(`Saiu da ${queue.name} com sucesso.`);
            emitWorkspaceSync({
                source: "shop-page:leave",
                shopId: shop?.id ?? null,
                queueId: queue.id,
                serviceId: queue.currentUserServiceId,
            });
            reload();
        } catch (err) {
            setJoinError(err instanceof Error ? err.message : "Falha ao sair da fila");
        } finally {
            setLeavingQueueId(null);
        }
    }

    async function transferQueue(targetQueue: QueueInfo) {
        if (!currentUserShopServiceId || !accessToken) {
            setJoinError("Nao foi possivel identificar a sua entrada atual na barbearia.");
            return;
        }

        if (targetQueue.status !== "open") {
            setJoinError("A fila de destino nao esta disponivel para mudanca neste momento.");
            return;
        }

        setTransferringQueueId(targetQueue.id);
        setJoinError("");
        setJoinSuccess("");

        try {
            const response = await authFetch(`/api/services/${toRequestId(currentUserShopServiceId)}/transfer/`, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    target_queue_id: toRequestId(targetQueue.id),
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || `Falha ao mudar de fila (${response.status})`);
            }

            setActiveClientModal(null);
            setJoinSuccess(`Mudou para ${targetQueue.name} sem nova taxa de fila.`);
            emitWorkspaceSync({
                source: "shop-page:transfer",
                shopId: shop?.id ?? null,
                queueId: targetQueue.id,
                serviceId: currentUserShopServiceId,
            });
            reload();
        } catch (error) {
            setJoinError(error instanceof Error ? error.message : "Falha ao mudar de fila");
        } finally {
            setTransferringQueueId(null);
        }
    }

    async function runQueueControlAction(action: "start" | "pause" | "resume" | "close" | "assign") {
        if (!queueControlModal || !accessToken) {
            setQueueControlError("Nao foi possivel validar a sua sessao.");
            return;
        }

        const payload: Record<string, unknown> = {};
        let successMessage = "";

        if (action === "start") {
            const selfBarberId =
                apiRole === "BARBER"
                    ? queueBarberOptions.find((option) => option.userId === String(authUser?.id))?.id ?? ""
                    : "";
            const barberToAssign =
                selectedQueueBarberId || queueControlModal.queue.assignedBarberId || selfBarberId || "";

            payload.status = "ACTIVE";
            if (barberToAssign) {
                payload.barber = toRequestId(barberToAssign);
            }
            successMessage = `Fila ${queueControlModal.queue.name} iniciada.`;
        } else if (action === "pause") {
            payload.status = "PAUSED";
            successMessage = `Fila ${queueControlModal.queue.name} colocada em pausa.`;
        } else if (action === "resume") {
            payload.status = "ACTIVE";
            successMessage = `Fila ${queueControlModal.queue.name} retomada.`;
        } else if (action === "close") {
            if (queueControlModal.queue.customers > 0) {
                if (!queueCloseNote.trim()) {
                    setQueueControlError("Indique a justificacao para fechar a fila com clientes ainda ativos.");
                    return;
                }

                setQueueControlPending(action);
                setQueueControlError("");
                setQueueControlSuccess("");

                try {
                    const response = await authFetch(`/api/queues/${toRequestId(queueControlModal.queue.id)}/close/`, {
                        method: "POST",
                        headers: {
                            Accept: "application/json",
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            note: queueCloseNote.trim(),
                        }),
                    });

                    if (!response.ok) {
                        const text = await response.text();
                        throw new Error(text || `Falha ao fechar a fila (${response.status})`);
                    }

                    setQueueControlSuccess(`Fila ${queueControlModal.queue.name} fechada.`);
                    setQueueControlModal(null);
                    setSelectedQueueBarberId("");
                    setQueueCloseNote("");
                    emitWorkspaceSync({
                        source: "shop-page:queue-close",
                        shopId: shop?.id ?? null,
                        queueId: queueControlModal.queue.id,
                    });
                    reload();
                } catch (error) {
                    setQueueControlError(error instanceof Error ? error.message : "Falha ao atualizar a fila");
                } finally {
                    setQueueControlPending(null);
                }
                return;
            }

            payload.status = "CLOSED";
            successMessage = `Fila ${queueControlModal.queue.name} fechada.`;
        } else {
            payload.barber = selectedQueueBarberId ? toRequestId(selectedQueueBarberId) : null;
            successMessage = selectedQueueBarberId
                ? "Barbeiro atribuido a fila com sucesso."
                : "Atribuicao de barbeiro removida.";
        }

        setQueueControlPending(action);
        setQueueControlError("");
        setQueueControlSuccess("");

        try {
            const response = await authFetch(`/api/queues/${toRequestId(queueControlModal.queue.id)}/`, {
                method: "PATCH",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || `Falha ao atualizar a fila (${response.status})`);
            }

            setQueueControlSuccess(successMessage);
            setQueueControlModal(null);
            setSelectedQueueBarberId("");
            setQueueCloseNote("");
            emitWorkspaceSync({
                source: "shop-page:queue-control",
                shopId: shop?.id ?? null,
                queueId: queueControlModal.queue.id,
            });
            reload();
        } catch (error) {
            setQueueControlError(error instanceof Error ? error.message : "Falha ao atualizar a fila");
        } finally {
            setQueueControlPending(null);
        }
    }

    async function createQueue() {
        if (!shop || !accessToken) {
            setCreateQueueError("Nao foi possivel validar a sua sessao.");
            return;
        }

        if (!createQueueBarberId) {
            setCreateQueueError("Selecione o barbeiro responsavel pela nova fila.");
            return;
        }

        setCreateQueuePending(true);
        setCreateQueueError("");
        setQueueControlSuccess("");

        try {
            const response = await authFetch("/api/queues/", {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    shop: toRequestId(shop.id),
                    barber: toRequestId(createQueueBarberId),
                    date: currentQueueDate,
                    status: "ACTIVE",
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || `Falha ao criar a fila (${response.status})`);
            }

            setQueueControlSuccess("Nova fila criada e aberta com sucesso.");
            setCreateQueueModalOpen(false);
            setCreateQueueBarberId("");
            emitWorkspaceSync({
                source: "shop-page:create-queue",
                shopId: shop.id,
            });
            reload();
        } catch (error) {
            setCreateQueueError(error instanceof Error ? error.message : "Falha ao criar a fila");
        } finally {
            setCreateQueuePending(false);
        }
    }

    async function runClientQueueAction(action: "start" | "complete" | "pause" | "resume" | "swap") {
        if (!activeClientModal || !accessToken) {
            setClientActionError("Nao foi possivel validar a sua sessao.");
            return;
        }

        const selectedClient = activeClientModal.client;
        let endpoint = "";
        let body: string | undefined;
        let successMessage = "";

        if (action === "start") {
            if (!selectedClient.serviceId) {
                setClientActionError("Cliente sem servico ativo na fila.");
                return;
            }
            endpoint = `/api/services/${toRequestId(selectedClient.serviceId)}/start/`;
            successMessage = `Atendimento iniciado para ${selectedClient.name}.`;
        } else if (action === "complete") {
            if (!selectedClient.serviceId) {
                setClientActionError("Cliente sem servico ativo na fila.");
                return;
            }
            endpoint = `/api/services/${toRequestId(selectedClient.serviceId)}/complete/`;
            successMessage = `Atendimento concluido para ${selectedClient.name}.`;
        } else if (action === "pause" || action === "resume") {
            endpoint = `/api/queues/${toRequestId(activeClientModal.queue.id)}/`;
            body = JSON.stringify({
                status: action === "pause" ? "PAUSED" : "ACTIVE",
            });
            successMessage =
                action === "pause"
                    ? `Fila ${activeClientModal.queue.name} colocada em pausa.`
                    : `Fila ${activeClientModal.queue.name} retomada.`;
        } else {
            if (!selectedClient.serviceId || !swapTargetServiceId) {
                setClientActionError("Selecione o cliente com quem deseja trocar a posicao.");
                return;
            }
            endpoint = `/api/services/${toRequestId(selectedClient.serviceId)}/swap-position/`;
            body = JSON.stringify({
                target_service_id: toRequestId(swapTargetServiceId),
            });
            successMessage = `Troca de posicao solicitada para ${selectedClient.name}.`;
        }

        setClientActionPending(action);
        setClientActionError("");
        setClientActionSuccess("");

        try {
            const response = await authFetch(endpoint, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    ...(body ? { "Content-Type": "application/json" } : {}),
                },
                ...(body ? { body } : {}),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || `Falha ao executar a acao (${response.status})`);
            }

            if (action === "start" || action === "complete") {
                const payload = (await response.json()) as ApiServiceActionResponse;
                setActiveClientModal((current) => {
                    if (!current || current.client.serviceId !== selectedClient.serviceId) return current;

                    const nextStatus = getServiceStatus(payload.status || selectedClient.serviceStatus);
                    const nextPositionValue =
                        typeof payload.position === "number" && Number.isFinite(payload.position)
                            ? payload.position
                            : typeof payload.position === "string" && payload.position.trim()
                              ? Number.parseInt(payload.position, 10)
                              : selectedClient.position ?? null;
                    const nextPosition =
                        nextStatus === "QUEUED" && Number.isFinite(nextPositionValue as number)
                            ? Number(nextPositionValue)
                            : null;

                    const updatedClient: QueueClientState = {
                        ...current.client,
                        serviceStatus: nextStatus,
                        serviceAverageTime:
                            payload.service_type?.average_time ?? current.client.serviceAverageTime ?? null,
                        position: nextPosition,
                        startTime:
                            action === "start"
                                ? payload.start_time ?? current.client.startTime ?? new Date().toISOString()
                                : current.client.startTime ?? null,
                        finishTime: action === "complete" ? payload.finish_time ?? new Date().toISOString() : current.client.finishTime ?? null,
                    };

                    const nextClients = current.clients.map((client) =>
                        client.serviceId === selectedClient.serviceId
                            ? {
                                  ...client,
                                  serviceStatus: nextStatus,
                                  serviceAverageTime: payload.service_type?.average_time ?? client.serviceAverageTime ?? null,
                                  position: nextPosition,
                                  startTime:
                                      action === "start"
                                          ? payload.start_time ?? client.startTime ?? new Date().toISOString()
                                          : client.startTime ?? null,
                                  finishTime:
                                      action === "complete"
                                          ? payload.finish_time ?? new Date().toISOString()
                                          : client.finishTime ?? null,
                              }
                            : client
                    );

                    return {
                        ...current,
                        client: updatedClient,
                        clients: nextClients,
                    };
                });
            }

            setClientActionSuccess(successMessage);
            if (action !== "start") {
                setActiveClientModal(null);
                setSwapTargetServiceId("");
            }
            emitWorkspaceSync({
                source: `shop-page:${action}`,
                shopId: shop?.id ?? null,
                queueId: activeClientModal.queue.id,
                serviceId: selectedClient.serviceId,
            });
            reload();
        } catch (err) {
            setClientActionError(err instanceof Error ? err.message : "Falha ao executar a acao");
        } finally {
            setClientActionPending(null);
        }
    }

    if (loading && !shop) {
        return (
            <div className="shop">
                <button className="shop__back" onClick={() => navigate(-1)}>
                    {"<"} Voltar
                </button>
                <p className="shop__empty">A carregar barbearia...</p>
            </div>
        );
    }

    if (!shop) {
        return (
            <div className="shop">
                <button className="shop__back" onClick={() => navigate(-1)}>
                    {"<"} Voltar
                </button>
                <p className="shop__empty">
                    {hasRestrictedMarketplaceAccess
                        ? "Nao tem acesso a esta barbearia no marketplace."
                        : "Barbearia nao encontrada."}
                </p>
            </div>
        );
    }

    if (!canEnterCurrentShop) {
        return (
            <div className="shop">
                <button className="shop__back" onClick={() => navigate(-1)}>
                    {"<"} Voltar
                </button>
                <p className="shop__empty">Nao tem acesso a esta barbearia no marketplace.</p>
            </div>
        );
    }

    return (
        <div className="shop">
            <button className="shop__back" onClick={() => navigate(-1)}>
                {"<"} Voltar
            </button>

            {joinSuccess && <div className="shop__message shop__message--success">{joinSuccess}</div>}
            {clientActionSuccess && <div className="shop__message shop__message--success">{clientActionSuccess}</div>}
            {clientActionError && <div className="shop__message shop__message--error">{clientActionError}</div>}
            {queueControlSuccess && <div className="shop__message shop__message--success">{queueControlSuccess}</div>}
            {queueControlError && <div className="shop__message shop__message--error">{queueControlError}</div>}

            <section className="shop__hero" style={{ backgroundImage: `url(${shop.image})` }}>
                <div className="shop__hero-overlay">
                    <div>
                        {shop.location && <p className="shop__location">{shop.location}</p>}
                        <h1>{shop.name}</h1>
                        {(shop.distanceKm > 0 || typeof shop.rating === "number") && (
                            <p className="shop__meta">
                                {shop.distanceKm > 0 && `${shop.distanceKm.toFixed(1)} km`}
                                {shop.distanceKm > 0 && typeof shop.rating === "number" && " | "}
                                {typeof shop.rating === "number" && `Nota ${shop.rating.toFixed(1)}`}
                            </p>
                        )}
                    </div>
                    {shop.description && <p className="shop__description">{shop.description}</p>}
                    <div className="shop__catalog">
                        <button className="shop__catalog-toggle" type="button" onClick={() => setCatalogOpen((prev) => !prev)}>
                            Catalogo de cortes
                            <span>{catalogOpen ? "-" : "+"}</span>
                        </button>
                        {catalogOpen && (
                            <ul className="shop__catalog-list">
                                {serviceTypes.length > 0
                                    ? serviceTypes.map((item) => (
                                          <li key={item.id}>
                                              <span>{item.name}</span>
                                              <strong>{item.priceMt != null ? formatMoney(item.priceMt) : "Preco a confirmar"}</strong>
                                          </li>
                                      ))
                                    : CATALOG.map((item) => (
                                          <li key={item.name}>
                                              <span>{item.name}</span>
                                              <strong>{item.price}</strong>
                                          </li>
                                      ))}
                            </ul>
                        )}
                    </div>
                </div>
            </section>

            <section>
                <div className="shop__section-heading">
                    <h2 className="shop__section-title">Filas disponiveis</h2>
                    {canManageQueueClients && (
                        <button type="button" className="shop__section-action" onClick={openCreateQueueModal}>
                            Nova fila
                        </button>
                    )}
                </div>
                {serviceTypesError && <p className="shop__message shop__message--warning">{serviceTypesError}</p>}

                <div className="shop__queues">
                    {shop.queues.length === 0 && canManageQueueClients && (
                        <article className="shop__queue-card shop__queue-card--empty">
                            <div>
                                <h3>Nenhuma fila criada para hoje</h3>
                                <p className="shop__queue-meta">
                                    Use o botao <strong>Nova fila</strong> acima para criar e abrir uma fila para hoje.
                                </p>
                            </div>
                        </article>
                    )}
                    {shop.queues.map((queue, index) => {
                        const mainBarber = queue.barbers[0]?.name ?? null;
                        const queueTitle = mainBarber ? `${queue.name} - ${mainBarber}` : queue.name;
                        const queueDateLabel = formatQueueDate(queue.date);
                        const isUserInQueue = Boolean(queue.currentUserServiceId);
                        const canTransferHere =
                            Boolean(currentUserShopServiceId) &&
                            currentUserQueue?.id !== queue.id &&
                            queue.status === "open";
                        const currentUserPosition = queue.currentUserPosition ?? null;
                        const canEnterQueue = queue.status === "open";
                        const canOpenQueueFromCard =
                            canManageQueueClients && (queue.status === "inactive" || queue.status === "closed");
                        const clients = [...createQueueClients(queue, authUser ?? undefined)].sort(compareQueueClients);
                        const isFilaUm = index === 0;
                        const useQueueStyle = isFilaUm || index > 0;
                        const cardClass = [
                            "shop__queue-card",
                            useQueueStyle && "shop__queue-card--secondary",
                            useQueueStyle && "queue__card",
                            isFilaUm && "queue__card--highlight",
                        ]
                            .filter(Boolean)
                            .join(" ");
                        const headerClass = useQueueStyle ? "queue__card-header" : "shop__queue-header";
                        const statusClass = useQueueStyle
                            ? `queue__status queue__status--${queue.status}`
                            : `shop__queue-status shop__queue-status--${queue.status}`;
                        const avatarsClass = useQueueStyle ? "shop__queue-avatars queue__avatars" : "shop__queue-avatars";
                        const emptyClass = useQueueStyle ? "queue__avatars-empty" : "shop__queue-empty";
                        const arrowClass = useQueueStyle ? "queue__avatars-arrow" : "shop__queue-arrow";

                        return (
                            <article key={queue.id} className={cardClass}>
                                <header className={headerClass}>
                                    <div>
                                        <h3>{queueTitle}</h3>
                                        {queueDateLabel && <p className="shop__queue-date">{queueDateLabel}</p>}
                                        <p className="shop__queue-meta">
                                            {queue.customers} clientes na fila | Espera estimada {queue.waitEstimate}
                                        </p>
                                    </div>
                                    <div className="shop__queue-header-actions">
                                        {canOpenQueueFromCard && (
                                            <button
                                                type="button"
                                                className="shop__queue-open-button"
                                                onClick={() => openQueueControlModal(queue)}
                                            >
                                                {queue.status === "closed" ? "Reabrir fila" : "Abrir fila"}
                                            </button>
                                        )}
                                        {canManageQueueClients && (
                                            <button
                                                type="button"
                                                className="shop__queue-tool"
                                                onClick={() => openQueueControlModal(queue)}
                                                aria-label={`Gerir ${queue.name}`}
                                            >
                                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                                    <path d="M10.5 4.5h3l.7 2.4a6.9 6.9 0 0 1 1.6.9l2.3-.9 1.5 2.6-1.7 1.8c.1.3.1.7.1 1s0 .7-.1 1l1.7 1.8-1.5 2.6-2.3-.9a6.9 6.9 0 0 1-1.6.9l-.7 2.4h-3l-.7-2.4a6.9 6.9 0 0 1-1.6-.9l-2.3.9-1.5-2.6 1.7-1.8A4.8 4.8 0 0 1 6 12c0-.3 0-.7.1-1L4.4 9.2l1.5-2.6 2.3.9a6.9 6.9 0 0 1 1.6-.9l.7-2.1Z" />
                                                    <circle cx="12" cy="12" r="2.6" />
                                                </svg>
                                            </button>
                                        )}
                                        <span className={statusClass}>{QUEUE_STATUS_LABEL[queue.status]}</span>
                                    </div>
                                </header>

                                <div
                                    className={avatarsClass}
                                    ref={(el) => {
                                        queueRefs.current[queue.id] = el;
                                        if (el) updateArrow(queue.id);
                                    }}
                                    onScroll={() => updateArrow(queue.id)}
                                >
                                    {clients.length > 0 &&
                                        clients.map((client, i) => {
                                            const isCurrent = i === 0;
                                            const isTrade = i === 1;
                                            const avatarBase = useQueueStyle ? "queue__avatar" : "shop__queue-avatar";
                                            const avatarCurrent = useQueueStyle ? "queue__avatar--current" : "shop__queue-avatar--current";
                                            const avatarTrade = useQueueStyle ? "queue__avatar--trade" : "shop__queue-avatar--trade";
                                            return (
                                                <button
                                                    key={client.id}
                                                    type="button"
                                                    className={`${avatarBase}${isCurrent ? ` ${avatarCurrent}` : ""}${isTrade ? ` ${avatarTrade}` : ""}${
                                                        client.isCurrentUser ? " queue__avatar--me" : ""
                                                    }`}
                                                    onClick={() => openClientModal(queue, client, clients)}
                                                >
                                                    <img src={client.avatar} alt={`Cliente ${client.name}`} />
                                                    <span className="queue__avatar-name">{client.name}</span>
                                                </button>
                                            );
                                        })}
                                    {canScrollRight[queue.id] && <span className={arrowClass}>{">>"}</span>}
                                </div>

                                <div className="shop__slot">
                                    <div>
                                        <p>{isUserInQueue ? "Sua posicao atual" : "Proxima posicao disponivel"}</p>
                                        <strong>#{isUserInQueue && currentUserPosition ? currentUserPosition : queue.customers + 1}</strong>
                                    </div>
                                    <button
                                        type="button"
                                        className={`shop__slot-button${isUserInQueue ? " shop__slot-button--danger" : ""}`}
                                        onClick={() =>
                                            isUserInQueue
                                                ? void leaveQueue(queue)
                                                : canTransferHere
                                                  ? void transferQueue(queue)
                                                  : openJoinModal(queue)
                                        }
                                        disabled={
                                            joining ||
                                            leavingQueueId === queue.id ||
                                            transferringQueueId === queue.id ||
                                            (!isUserInQueue && !canTransferHere && !canEnterQueue)
                                        }
                                    >
                                        {leavingQueueId === queue.id
                                            ? "A sair..."
                                            : transferringQueueId === queue.id
                                              ? "A mudar..."
                                            : isUserInQueue
                                              ? "Abandonar fila"
                                              : canTransferHere
                                                ? "Mudar para esta fila"
                                              : queue.status === "paused"
                                                ? "Fila em pausa"
                                                : queue.status === "inactive"
                                                  ? "Nao iniciada"
                                                  : queue.status === "closed"
                                                    ? "Fechada"
                                                    : "Entrar"}
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </section>

            {queueControlModal && (
                <div className="shop__profile-backdrop" onClick={closeQueueControlModal}>
                    <div
                        className="shop__profile-modal shop__profile-modal--queue-control"
                        onClick={(event) => event.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                    >
                        <button type="button" className="shop__profile-close" onClick={closeQueueControlModal}>
                            x
                        </button>
                        <div className="shop__queue-control">
                            <div className="shop__queue-control-header">
                                <span className={`shop__queue-control-status shop__queue-control-status--${queueControlModal.queue.status}`}>
                                    {QUEUE_STATUS_LABEL[queueControlModal.queue.status]}
                                </span>
                                <h3>Gerir fila</h3>
                                <p>{queueControlModal.queue.name}</p>
                            </div>

                            <div className="shop__queue-control-grid">
                                <div className="shop__queue-control-card">
                                    <span>Barbearia</span>
                                    <strong>{shop.name}</strong>
                                </div>
                                <div className="shop__queue-control-card">
                                    <span>Barbeiro atual</span>
                                    <strong>{currentQueueBarberLabel}</strong>
                                </div>
                            </div>

                            {canAssignQueueBarber && (
                                <label className="shop__profile-field">
                                    <span>Atribuir barbeiro</span>
                                    <select
                                        className="shop__profile-select"
                                        value={selectedQueueBarberId}
                                        onChange={(event) => setSelectedQueueBarberId(event.target.value)}
                                        disabled={queueBarbersLoading || queueControlPending !== null}
                                    >
                                        <option value="">Sem barbeiro</option>
                                        {queueBarberOptions.map((option) => (
                                            <option key={option.id} value={option.id}>
                                                {option.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}

                            <div className="shop__queue-control-actions">
                                {(queueControlModal.queue.status === "inactive" || queueControlModal.queue.status === "closed") && (
                                    <button
                                        type="button"
                                        className="shop__profile-action"
                                        onClick={() => void runQueueControlAction("start")}
                                        disabled={queueControlPending !== null}
                                    >
                                        {queueControlPending === "start"
                                            ? "A iniciar..."
                                            : queueControlModal.queue.status === "inactive"
                                              ? "Iniciar fila"
                                              : "Reabrir fila"}
                                    </button>
                                )}

                                {queueControlModal.queue.status === "open" && (
                                    <button
                                        type="button"
                                        className="shop__profile-action"
                                        onClick={() => void runQueueControlAction("pause")}
                                        disabled={queueControlPending !== null}
                                    >
                                        {queueControlPending === "pause" ? "A pausar..." : "Pausar fila"}
                                    </button>
                                )}

                                {queueControlModal.queue.status === "paused" && (
                                    <button
                                        type="button"
                                        className="shop__profile-action"
                                        onClick={() => void runQueueControlAction("resume")}
                                        disabled={queueControlPending !== null}
                                    >
                                        {queueControlPending === "resume" ? "A retomar..." : "Retomar fila"}
                                    </button>
                                )}

                                {(queueControlModal.queue.status === "open" || queueControlModal.queue.status === "paused") && (
                                    <button
                                        type="button"
                                        className="shop__profile-action shop__profile-action--danger"
                                        onClick={() => void runQueueControlAction("close")}
                                        disabled={queueControlPending !== null}
                                    >
                                        {queueControlPending === "close" ? "A fechar..." : "Fechar fila"}
                                    </button>
                                )}

                                {canAssignQueueBarber && (
                                    <button
                                        type="button"
                                        className="shop__profile-action"
                                        onClick={() => void runQueueControlAction("assign")}
                                        disabled={queueControlPending !== null || queueBarbersLoading}
                                    >
                                        {queueControlPending === "assign" ? "A guardar..." : "Guardar barbeiro"}
                                    </button>
                                )}
                            </div>

                            <p className="shop__profile-note">
                                A fila comeca o dia nao iniciada. O barbeiro ou o gestor podem iniciar, pausar, retomar,
                                fechar e ajustar o barbeiro responsavel por aqui.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {createQueueModalOpen && (
                <div className="shop__profile-backdrop" onClick={closeCreateQueueModal}>
                    <div
                        className="shop__profile-modal shop__profile-modal--queue-control"
                        onClick={(event) => event.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                    >
                        <button type="button" className="shop__profile-close" onClick={closeCreateQueueModal}>
                            x
                        </button>
                        <div className="shop__queue-control">
                            <div className="shop__queue-control-header">
                                <span className="shop__queue-control-status shop__queue-control-status--open">Nova fila</span>
                                <h3>Criar fila</h3>
                                <p>{shop.name}</p>
                            </div>

                            <div className="shop__queue-control-grid">
                                <div className="shop__queue-control-card">
                                    <span>Data da fila</span>
                                    <strong>{formatQueueDate(currentQueueDate) || currentQueueDate}</strong>
                                </div>
                                <div className="shop__queue-control-card">
                                    <span>Estado inicial</span>
                                    <strong>Aberta</strong>
                                </div>
                            </div>

                            <label className="shop__profile-field">
                                <span>Barbeiro responsavel</span>
                                <select
                                    className="shop__profile-select"
                                    value={createQueueBarberId}
                                    onChange={(event) => setCreateQueueBarberId(event.target.value)}
                                    disabled={queueBarbersLoading || createQueuePending}
                                >
                                    <option value="">Selecione um barbeiro</option>
                                    {queueBarberOptions.map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {option.name}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            {createQueueError && <p className="shop__message shop__message--error">{createQueueError}</p>}

                            <div className="shop__queue-control-actions">
                                <button
                                    type="button"
                                    className="shop__profile-action"
                                    onClick={() => void createQueue()}
                                    disabled={createQueuePending || queueBarbersLoading}
                                >
                                    {createQueuePending ? "A criar..." : "Criar e abrir fila"}
                                </button>
                            </div>

                            <p className="shop__profile-note">
                                A nova fila e criada para a data atual e fica imediatamente aberta para inscricoes.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {activeClientModal && (
                <div className="shop__profile-backdrop" onClick={closeClientModal}>
                    <div
                        className={`shop__profile-modal${
                            activeClientModal.mode === "self" || activeClientModal.mode === "manage" ? " shop__profile-modal--split" : ""
                        }`}
                        onClick={(event) => event.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                    >
                        <button type="button" className="shop__profile-close" onClick={closeClientModal}>
                            x
                        </button>

                        {activeClientModal.mode === "preview" ? (
                            <div className="shop__profile-preview">
                                <div className="shop__profile-avatar">
                                    <img src={activeClientModal.client.avatar} alt={activeClientModal.client.name} />
                                </div>
                                <strong>{activeClientModal.client.name}</strong>
                                <span>{activeClientModal.client.phone}</span>
                                <small>{activeClientModal.queue.name}</small>
                                <div className="shop__profile-stack shop__profile-stack--compact">
                                    <div className="shop__profile-detail">
                                        <span>Estado</span>
                                        <strong>{getServiceStatusLabel(activeClientModal.client.serviceStatus)}</strong>
                                    </div>
                                    {activeServiceCountdown && (
                                        <div
                                            className={`shop__profile-detail shop__profile-detail--timer${
                                                activeServiceCountdown.completed ? " shop__profile-detail--timer-finished" : ""
                                            }`}
                                        >
                                            <span>Tempo restante</span>
                                            <strong>
                                                {activeServiceCountdown.completed
                                                    ? "00:00"
                                                    : formatCountdown(activeServiceCountdown.remainingSeconds)}
                                            </strong>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : activeClientModal.mode === "manage" ? (
                            <div className="shop__profile-split">
                                <div className="shop__profile-media">
                                    <div className="shop__profile-avatar shop__profile-avatar--large">
                                        <img src={activeClientModal.client.avatar} alt={activeClientModal.client.name} />
                                    </div>
                                    <strong>{activeClientModal.client.name}</strong>
                                    <span>{activeClientModal.client.phone}</span>
                                    <small>{activeClientModal.queue.name}</small>
                                </div>

                                <div className="shop__profile-actions">
                                    <h3>Gerir cliente</h3>
                                    <p>{shop?.name || activeClientModal.queue.name}</p>

                                    <div className="shop__profile-stack">
                                        <div className="shop__profile-detail">
                                            <span>Estado</span>
                                            <strong>{getServiceStatusLabel(activeClientModal.client.serviceStatus)}</strong>
                                        </div>
                                        {activeClientModal.client.serviceName && (
                                            <div className="shop__profile-detail">
                                                <span>Servico</span>
                                                <strong>{activeClientModal.client.serviceName}</strong>
                                            </div>
                                        )}
                                        {activeServiceCountdown && (
                                            <div
                                                className={`shop__profile-detail shop__profile-detail--timer${
                                                    activeServiceCountdown.completed ? " shop__profile-detail--timer-finished" : ""
                                                }`}
                                            >
                                                <span>Tempo restante</span>
                                                <strong>
                                                    {activeServiceCountdown.completed
                                                        ? "00:00"
                                                        : formatCountdown(activeServiceCountdown.remainingSeconds)}
                                                </strong>
                                            </div>
                                        )}
                                        {typeof activeClientModal.client.position === "number" &&
                                            Number.isFinite(activeClientModal.client.position) &&
                                            activeClientModal.client.position > 0 && (
                                                <div className="shop__profile-detail">
                                                    <span>Posicao</span>
                                                    <strong>#{activeClientModal.client.position}</strong>
                                                </div>
                                            )}
                                    </div>

                                    {modalPrimaryServiceAction && (
                                        <button
                                            type="button"
                                            className={`shop__profile-action${
                                                modalPrimaryServiceAction.danger ? " shop__profile-action--danger" : ""
                                            }`}
                                            onClick={() => void runClientQueueAction(modalPrimaryServiceAction.action)}
                                            disabled={clientActionPending !== null}
                                        >
                                            {clientActionPending === modalPrimaryServiceAction.action
                                                ? modalPrimaryServiceAction.pendingLabel
                                                : modalPrimaryServiceAction.label}
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        className={`shop__profile-action${
                                            activeClientModal.queue.status === "paused" ? " shop__profile-action--active" : ""
                                        }`}
                                        onClick={() =>
                                            void runClientQueueAction(
                                                activeClientModal.queue.status === "paused" ? "resume" : "pause"
                                            )
                                        }
                                        disabled={clientActionPending !== null}
                                    >
                                        {clientActionPending === "pause"
                                            ? "A pausar..."
                                            : clientActionPending === "resume"
                                              ? "A retomar..."
                                              : activeClientModal.queue.status === "paused"
                                                ? "Retomar fila"
                                                : "Pausar fila"}
                                    </button>

                                    {getServiceStatus(activeClientModal.client.serviceStatus) === "QUEUED" &&
                                        modalSwapCandidates.length > 0 && (
                                            <div className="shop__profile-stack">
                                                <label className="shop__profile-field">
                                                    <span>Trocar com</span>
                                                    <select
                                                        className="shop__profile-select"
                                                        value={swapTargetServiceId}
                                                        onChange={(event) => setSwapTargetServiceId(event.target.value)}
                                                        disabled={clientActionPending !== null}
                                                    >
                                                        <option value="">Selecione um cliente</option>
                                                        {modalSwapCandidates.map((candidate) => (
                                                            <option key={candidate.serviceId} value={candidate.serviceId || ""}>
                                                                {`${candidate.name}${candidate.position ? ` (#${candidate.position})` : ""}`}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>
                                                <button
                                                    type="button"
                                                    className="shop__profile-action"
                                                    onClick={() => void runClientQueueAction("swap")}
                                                    disabled={!swapTargetServiceId || clientActionPending !== null}
                                                >
                                                    {clientActionPending === "swap" ? "A trocar..." : "Trocar posicao"}
                                                </button>
                                            </div>
                                        )}

                                    {!modalCanStartSelected &&
                                        !modalCanFinishSelected &&
                                        getServiceStatus(activeClientModal.client.serviceStatus) === "QUEUED" &&
                                        modalFirstQueuedClient?.serviceId !== activeClientModal.client.serviceId && (
                                            <p className="shop__profile-note">
                                                Inicie primeiro {modalFirstQueuedClient?.name || "o cliente no topo da fila"}.
                                            </p>
                                        )}

                                    {activeServiceCountdown?.completed && (
                                        <p className="shop__profile-note">
                                            O tempo previsto terminou. Conclua o atendimento quando o servico estiver efetivamente encerrado.
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="shop__profile-split">
                                <div className="shop__profile-media">
                                    <div className="shop__profile-avatar shop__profile-avatar--large">
                                        <img src={activeClientModal.client.avatar} alt={activeClientModal.client.name} />
                                    </div>
                                    <strong>{activeClientModal.client.name}</strong>
                                    <span>{activeClientModal.client.phone}</span>
                                    <small>{`Posicao atual #${activeClientModal.queue.currentUserPosition ?? activeClientModal.queue.customers}`}</small>
                                </div>

                                <div className="shop__profile-actions">
                                    <h3>Gerir a minha posicao</h3>
                                    <p>{activeClientModal.queue.name}</p>

                                    {activeServiceCountdown && (
                                        <div
                                            className={`shop__profile-detail shop__profile-detail--timer${
                                                activeServiceCountdown.completed ? " shop__profile-detail--timer-finished" : ""
                                            }`}
                                        >
                                            <span>Tempo restante</span>
                                            <strong>
                                                {activeServiceCountdown.completed
                                                    ? "00:00"
                                                    : formatCountdown(activeServiceCountdown.remainingSeconds)}
                                            </strong>
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        className={`shop__profile-action${
                                            userSwapOffers[activeClientModal.queue.currentUserServiceId || activeClientModal.queue.id]
                                                ? " shop__profile-action--active"
                                                : ""
                                        }`}
                                        onClick={() =>
                                            setUserSwapOffers((prev) => ({
                                                ...prev,
                                                [activeClientModal.queue.currentUserServiceId || activeClientModal.queue.id]:
                                                    !prev[activeClientModal.queue.currentUserServiceId || activeClientModal.queue.id],
                                            }))
                                        }
                                    >
                                        {userSwapOffers[activeClientModal.queue.currentUserServiceId || activeClientModal.queue.id]
                                            ? "Minha posicao disponibilizada"
                                            : "Disponibilizar minha posicao"}
                                    </button>

                                    <button
                                        type="button"
                                        className="shop__profile-action shop__profile-action--danger"
                                        onClick={() => void leaveQueue(activeClientModal.queue)}
                                        disabled={leavingQueueId === activeClientModal.queue.id}
                                    >
                                        {leavingQueueId === activeClientModal.queue.id ? "A sair..." : "Abandonar fila"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {serviceAutomation && serviceAutomation.remainingSeconds > 0 && (
                <div className="shop__service-automation-overlay" aria-live="assertive">
                    <div
                        className={`shop__service-automation shop__service-automation--${serviceAutomation.phase}${
                            serviceAutomationPending ? " shop__service-automation--pending" : ""
                        }`}
                    >
                        <span className="shop__service-automation-label">
                            {serviceAutomation.phase === "complete"
                                ? "Conclusao automatica"
                                : "Inicio automatico do proximo atendimento"}
                        </span>
                        <strong>{serviceAutomation.remainingSeconds}</strong>
                        <p>{serviceAutomation.clientName}</p>
                        <small>
                            {serviceAutomation.phase === "complete"
                                ? `O atendimento em ${serviceAutomation.queueName} termina em instantes.`
                                : `O atendimento em ${serviceAutomation.queueName} vai arrancar automaticamente.`}
                        </small>
                        <button
                            type="button"
                            className={`shop__service-automation-toggle${
                                serviceAutomation.isPaused ? " shop__service-automation-toggle--paused" : ""
                            }`}
                            onClick={() =>
                                setServiceAutomation((current) =>
                                    current ? { ...current, isPaused: !current.isPaused } : current
                                )
                            }
                            disabled={Boolean(serviceAutomationPending)}
                        >
                            {serviceAutomation.isPaused ? "Retomar contagem" : "Pausar contagem"}
                        </button>
                    </div>
                </div>
            )}

            {joinModal && (
                <div className="shop__modal-backdrop" onClick={closeJoinModal}>
                    <div className="shop__modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
                        <button type="button" className="shop__modal-close" onClick={closeJoinModal}>
                            x
                        </button>
                        <div className="shop__modal-step">{joinStep === "select" ? "1/2" : "2/2"}</div>
                        <h3>{joinStep === "select" ? "Entrar na fila" : "Confirmar entrada"}</h3>
                        <p className="shop__modal-text">
                            {joinStep === "select"
                                ? `Selecione o servico para entrar na ${joinModal.queue.name}.`
                                : "Ao confirmar, 10 MT serao debitados da sua conta para reservar a vaga."}
                        </p>

                        {joinStep === "select" ? (
                            <>
                                <div className="shop__service-list">
                                    {serviceTypesLoading && <p className="shop__modal-note">A carregar servicos...</p>}
                                    {!serviceTypesLoading && serviceTypes.length === 0 && (
                                        <p className="shop__modal-note">Nao ha servicos disponiveis para esta barbearia.</p>
                                    )}
                                    {serviceTypes.map((service) => {
                                        const selected = service.id === selectedServiceId;
                                        return (
                                            <button
                                                key={service.id}
                                                type="button"
                                                className={`shop__service-option${selected ? " shop__service-option--active" : ""}`}
                                                onClick={() => setSelectedServiceId(service.id)}
                                            >
                                                <span>
                                                    <strong>{service.name}</strong>
                                                    <small>{service.averageTime ? `Tempo medio ${service.averageTime}` : "Tempo medio a confirmar"}</small>
                                                </span>
                                                <em>{service.priceMt != null ? formatMoney(service.priceMt) : "Preco a confirmar"}</em>
                                            </button>
                                        );
                                    })}
                                </div>

                                <label className="shop__checkbox">
                                    <input
                                        type="checkbox"
                                        checked={payServiceViaAccount}
                                        onChange={(event) => setPayServiceViaAccount(event.target.checked)}
                                        disabled={!shopHasCurrentAccount || !userHasCurrentAccount}
                                    />
                                    <span>Pagar o servico pela conta tambem</span>
                                </label>
                                <p className="shop__modal-note">
                                    Nao selecione esta opcao se quiser pagar em dinheiro.
                                </p>

                                <label className="shop__tip-field">
                                    <span>Gorjeta opcional (MZN)</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        inputMode="decimal"
                                        value={tipAmountInput}
                                        onChange={(event) => setTipAmountInput(event.target.value)}
                                        placeholder="0"
                                        disabled={!shopHasCurrentAccount}
                                    />
                                </label>
                            </>
                        ) : (
                            <div className="shop__confirm-box">
                                <div className="shop__confirm-row">
                                    <span>Servico selecionado</span>
                                    <strong>{selectedService?.name}</strong>
                                </div>
                                <div className="shop__confirm-row">
                                    <span>Taxa de entrada na fila</span>
                                    <strong>{formatMoney(JOIN_FEE_MT)}</strong>
                                </div>
                                {payServiceViaAccount && selectedService?.priceMt != null && (
                                    <div className="shop__confirm-row">
                                        <span>Servico pago pela conta</span>
                                        <strong>{formatMoney(selectedService.priceMt)}</strong>
                                    </div>
                                )}
                                {tipAmount > 0 && (
                                    <div className="shop__confirm-row">
                                        <span>Gorjeta</span>
                                        <strong>{formatMoney(tipAmount)}</strong>
                                    </div>
                                )}
                                <div className="shop__confirm-row shop__confirm-row--total">
                                    <span>Total a debitar</span>
                                    <strong>{formatMoney(totalDebit)}</strong>
                                </div>
                                <div className="shop__confirm-row">
                                    <span>Saldo disponivel</span>
                                    <strong>{formatMoney(accountBalance)}</strong>
                                </div>
                            </div>
                        )}

                        {joinError && <div className="shop__message shop__message--error">{joinError}</div>}

                        <div className="shop__modal-actions">
                            {joinStep === "confirm" && (
                                <button type="button" className="shop__modal-secondary" onClick={() => setJoinStep("select")}>
                                    Voltar
                                </button>
                            )}
                            <button
                                type="button"
                                className="shop__modal-primary"
                                onClick={joinStep === "select" ? continueToConfirmation : confirmJoinQueue}
                                disabled={joining || serviceTypesLoading || (!selectedServiceId && joinStep === "select")}
                            >
                                {joining ? "A confirmar..." : joinStep === "select" ? "Continuar" : "Confirmar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
