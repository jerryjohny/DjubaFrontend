import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../authContext';
import { BarberInfo, QueueClientInfo, QueueInfo, QueueStatus, SHOPS, ShopInfo } from '../data/shops';

type ApiShop = {
    id: number | string;
    name: string;
    manager?: { id?: number | string } | number | string | null;
    is_active?: boolean;
    street_or_avenue?: string;
    area_or_zona?: string;
    number?: number | string | null;
    other_reference?: string;
    cover_photo?: string | null;
    has_current_account?: boolean | null;
    current_account?: string | null;
    accepts_account_payments?: boolean | null;
};

type ApiQueue = {
    id: number | string;
    name?: string | null;
    date?: string | null;
    shop?: { id?: number | string } | number | string | null;
    barber?: { id?: number | string } | number | string | null;
    status?: string | null;
};

type ApiBarberProfile = {
    id: number | string;
    shop?: { id?: number | string } | number | string | null;
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
};

type ApiService = {
    id: number | string;
    joined_queue_at?: string | null;
    left_queue_at?: string | null;
    status?: string | null;
    position?: number | string | null;
    start_time?: string | null;
    finish_time?: string | null;
    queue?:
        | {
              id?: number | string;
              name?: string | null;
              date?: string | null;
              status?: string | null;
              shop?: { id?: number | string } | number | string | null;
              barber?: { id?: number | string } | number | string | null;
          }
        | number
        | string
        | null;
    customer?:
        | {
              id?: number | string;
              first_name?: string | null;
              last_name?: string | null;
              email?: string | null;
              telefone?: string | null;
              profile_picture?: string | null;
              profile_picture_link?: string | null;
              user?:
                  | {
                        id?: number | string;
                        first_name?: string | null;
                        last_name?: string | null;
                        email?: string | null;
                        telefone?: string | null;
                        profile_picture?: string | null;
                        profile_picture_link?: string | null;
                    }
                  | number
                  | string
                  | null;
          }
        | number
        | string
        | null;
    service_type?: { name?: string | null; average_time?: string | null; barbershop?: { id?: number | string } | number | string | null } | null;
};

type UseShopsResult = {
    shops: ShopInfo[];
    enterableShopIds: string[];
    loading: boolean;
    error: string | null;
    usingFallback: boolean;
    reload: () => void;
};

function canSeeAllShops(role?: string | null) {
    const upper = String(role || '').toUpperCase();
    return upper === 'CUSTOMER' || upper === 'SYS_ADMIN' || upper === 'ADMIN';
}

const FALLBACK_IMAGES = SHOPS.map((shop) => shop.image);
const FALLBACK_AVATARS = [
    'https://i.pravatar.cc/100?img=5',
    'https://i.pravatar.cc/100?img=15',
    'https://i.pravatar.cc/100?img=25',
    'https://i.pravatar.cc/100?img=35',
    'https://i.pravatar.cc/100?img=45',
];

function normalizeName(value?: string) {
    return value?.trim().toLowerCase() ?? '';
}

function fallbackClientName(index: number) {
    return `Cliente ${index + 1}`;
}

function getNestedId(value: unknown): string | null {
    if (value == null) return null;
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (typeof value === 'object' && 'id' in value) {
        const nested = (value as { id?: string | number }).id;
        return nested == null ? null : String(nested);
    }
    return null;
}

function getDisplayName(parts: Array<string | null | undefined>, fallback: string) {
    const joined = parts
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(' ')
        .trim();

    return joined || fallback;
}

function compareByServiceId(a: ApiService, b: ApiService) {
    const aId = Number(a.id);
    const bId = Number(b.id);

    if (Number.isFinite(aId) && Number.isFinite(bId)) {
        return aId - bId;
    }

    return String(a.id).localeCompare(String(b.id));
}

function compareByQueueJoinTime(a: ApiService, b: ApiService) {
    const aTime = a.joined_queue_at ? Date.parse(a.joined_queue_at) : Number.NaN;
    const bTime = b.joined_queue_at ? Date.parse(b.joined_queue_at) : Number.NaN;
    const aHasTime = Number.isFinite(aTime);
    const bHasTime = Number.isFinite(bTime);

    if (aHasTime && bHasTime && aTime !== bTime) {
        return aTime - bTime;
    }

    if (aHasTime && !bHasTime) return -1;
    if (!aHasTime && bHasTime) return 1;

    return compareByServiceId(a, b);
}

function parsePosition(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
    }
    return Number.MAX_SAFE_INTEGER;
}

function getActiveServiceRank(service: ApiService) {
    const status = String(service.status || '').toUpperCase();
    if (status === 'IN_SERVICE') return 0;
    if (status === 'QUEUED' || !status) return 1;
    return 2;
}

function compareActiveQueueServices(a: ApiService, b: ApiService) {
    const rankDelta = getActiveServiceRank(a) - getActiveServiceRank(b);
    if (rankDelta !== 0) return rankDelta;

    const positionDelta = parsePosition(a.position) - parsePosition(b.position);
    if (Number.isFinite(positionDelta) && positionDelta !== 0) return positionDelta;

    return compareByQueueJoinTime(a, b);
}

function parseAverageMinutes(raw?: string | null) {
    if (!raw) return null;
    const [hours, minutes, seconds] = raw.split(':').map((part) => Number(part));
    if ([hours, minutes, seconds].some((part) => Number.isNaN(part))) return null;
    return hours * 60 + minutes + Math.round(seconds / 60);
}

function formatWaitEstimate(minutes: number | null, fallback?: string) {
    if (!minutes || minutes <= 0) return fallback ?? '~15 min';
    return `~${minutes} min`;
}

function mapQueueStatus(status?: string | null, fallback?: QueueStatus): QueueStatus {
    const upper = status?.toUpperCase() ?? '';

    if (upper.includes('INACTIVE')) return 'inactive';
    if (upper.includes('PAUSE')) return 'paused';
    if (upper.includes('CLOSE')) return 'closed';
    if (upper.includes('SOON')) return 'closingSoon';
    if (upper.includes('ACTIVE') || upper.includes('OPEN')) return 'open';

    return fallback ?? 'open';
}

function buildLocation(shop: ApiShop, fallback?: ShopInfo) {
    const street = shop.street_or_avenue?.trim();
    const number = shop.number ? String(shop.number).trim() : '';
    const area = shop.area_or_zona?.trim();
    const reference = shop.other_reference?.trim();

    const main = [street, number].filter(Boolean).join(', ');
    const secondary = area || reference;
    const composed = [main, secondary].filter(Boolean).join(' - ');

    return composed || fallback?.location;
}

function buildStatus(shop: ApiShop, fallback?: ShopInfo): ShopInfo['status'] {
    if (typeof shop.is_active === 'boolean') {
        if (shop.is_active) {
            if (fallback?.status.type && fallback.status.type !== 'closed') {
                return fallback.status;
            }
            return { type: 'open', time: fallback?.status.time ?? '21h00' };
        }

        return { type: 'closed', time: fallback?.status.time ?? '09h00' };
    }

    return fallback?.status ?? { type: 'open', time: '21h00' };
}

function buildHasCurrentAccount(shop: ApiShop, fallback?: ShopInfo) {
    if (typeof shop.has_current_account === 'boolean') {
        return shop.has_current_account;
    }

    if (typeof shop.accepts_account_payments === 'boolean') {
        return shop.accepts_account_payments;
    }

    if (typeof shop.current_account === 'string') {
        return shop.current_account.trim().length > 0;
    }

    return fallback?.hasCurrentAccount ?? true;
}

function getCurrentMaputoDateKey() {
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Africa/Maputo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
}

function shouldDisplayQueue(queue: ApiQueue | undefined, todayKey: string) {
    if (!queue) return true;
    const queueDate = queue.date?.trim();
    const status = mapQueueStatus(queue.status);

    if (status === 'closed' && queueDate && queueDate !== todayKey) {
        return false;
    }

    return true;
}

function buildQueues(
    shopId: string,
    apiQueuesByShop: Map<string, ApiQueue[]>,
    apiQueueById: Map<string, ApiQueue>,
    queueIdsByShop: Map<string, string[]>,
    barbersById: Map<string, BarberInfo>,
    servicesByQueue: Map<string, ApiService[]>,
    todayKey: string,
    currentUser?: { id?: number; first_name?: string; last_name?: string; email?: string; telefone?: string; profile_picture?: string },
    fallback?: ShopInfo
): QueueInfo[] {
    const queueIds = [...(queueIdsByShop.get(shopId) ?? [])];

    (apiQueuesByShop.get(shopId) ?? []).forEach((queue) => {
        const queueId = String(queue.id);
        if (!queueIds.includes(queueId)) {
            queueIds.push(queueId);
        }
    });

    const queues: QueueInfo[] = [];

    queueIds.forEach((queueId, index) => {
        const queue = apiQueueById.get(queueId);
        if (!shouldDisplayQueue(queue, todayKey)) {
            return;
        }
        const fallbackQueue = fallback?.queues.find((item) => item.id === queueId) ?? fallback?.queues[index];
        const queueServices = [...(servicesByQueue.get(queueId) ?? [])].sort(compareActiveQueueServices);
        const averageMinutes =
            queueServices
                .map((service) => parseAverageMinutes(service.service_type?.average_time))
                .find((value) => value && value > 0) ?? null;
        const customers = queueServices.length;
        const assignedBarberId = getNestedId(queue?.barber);
        const assignedBarber = assignedBarberId ? barbersById.get(assignedBarberId) ?? null : null;

        queues.push({
            id: queueId,
            name: queue?.name?.trim() || fallbackQueue?.name || `Fila ${index + 1}`,
            date: queue?.date?.trim() || null,
            status: mapQueueStatus(queue?.status, fallbackQueue?.status),
            assignedBarberId,
            waitEstimate: formatWaitEstimate(averageMinutes ? averageMinutes * Math.max(customers, 1) : null),
            capacity: fallbackQueue?.capacity ?? Math.max(customers + 4, 8),
            customers,
            barbers: assignedBarber ? [assignedBarber] : [],
            clients: queueServices.map((service, clientIndex) => {
                const rawCustomer = typeof service.customer === 'object' && service.customer ? service.customer : null;
                const rawUser =
                    rawCustomer && 'user' in rawCustomer && typeof rawCustomer.user === 'object' && rawCustomer.user
                        ? rawCustomer.user
                        : null;
                const customerId = getNestedId(rawCustomer) ?? getNestedId(rawUser) ?? `${queueId}-${service.id}`;
                const matchesCurrentUser = currentUser?.id != null && getNestedId(service.customer) === String(currentUser.id);
                const displayName = matchesCurrentUser
                    ? getDisplayName(
                          [currentUser?.first_name, currentUser?.last_name],
                          currentUser?.email?.split('@')[0] || fallbackClientName(clientIndex)
                      )
                    : getDisplayName(
                          [
                              rawUser && 'first_name' in rawUser ? rawUser.first_name : null,
                              rawUser && 'last_name' in rawUser ? rawUser.last_name : null,
                              rawCustomer && 'first_name' in rawCustomer ? rawCustomer.first_name : null,
                              rawCustomer && 'last_name' in rawCustomer ? rawCustomer.last_name : null,
                          ],
                          (rawUser && 'email' in rawUser ? rawUser.email : null) ||
                              (rawCustomer && 'email' in rawCustomer ? rawCustomer.email : null) ||
                              fallbackClientName(clientIndex)
                      );
                const phone = matchesCurrentUser
                    ? currentUser?.telefone?.trim() || 'Sem telefone'
                    : (rawUser && 'telefone' in rawUser ? rawUser.telefone : null) ||
                      (rawCustomer && 'telefone' in rawCustomer ? rawCustomer.telefone : null) ||
                      'Sem telefone';
                const avatar = matchesCurrentUser
                    ? currentUser?.profile_picture?.trim() || FALLBACK_AVATARS[clientIndex % FALLBACK_AVATARS.length]
                    : (rawUser && 'profile_picture' in rawUser ? rawUser.profile_picture : null) ||
                      (rawUser && 'profile_picture_link' in rawUser ? rawUser.profile_picture_link : null) ||
                      (rawCustomer && 'profile_picture' in rawCustomer ? rawCustomer.profile_picture : null) ||
                      (rawCustomer && 'profile_picture_link' in rawCustomer ? rawCustomer.profile_picture_link : null) ||
                      FALLBACK_AVATARS[clientIndex % FALLBACK_AVATARS.length];

                const servicePosition = parsePosition(service.position);

                return {
                    id: String(customerId),
                    name: displayName,
                    phone,
                    avatar,
                    serviceId: String(service.id),
                    serviceStatus: String(service.status || '').toUpperCase() || null,
                    serviceName: service.service_type?.name?.trim() || null,
                    position: servicePosition === Number.MAX_SAFE_INTEGER ? null : servicePosition,
                    joinedQueueAt: service.joined_queue_at ?? null,
                } satisfies QueueClientInfo;
            }),
            currentUserServiceId:
                currentUser?.id != null
                    ? (
                          queueServices.find((service) => {
                                  const nestedUserId =
                                      typeof service.customer === 'object' && service.customer && 'user' in service.customer
                                          ? getNestedId(service.customer.user)
                                          : null;

                                  return getNestedId(service.customer) === String(currentUser.id) || nestedUserId === String(currentUser.id);
                          })?.id ?? null
                      )?.toString() ?? null
                    : null,
            currentUserPosition:
                currentUser?.id != null
                    ? (() => {
                          const position =
                              queueServices.findIndex((service) => {
                                  const nestedUserId =
                                      typeof service.customer === 'object' && service.customer && 'user' in service.customer
                                          ? getNestedId(service.customer.user)
                                          : null;

                                  return getNestedId(service.customer) === String(currentUser.id) || nestedUserId === String(currentUser.id);
                              }) + 1;

                          return position > 0 ? position : null;
                      })()
                    : null,
            currentUserServiceName:
                currentUser?.id != null
                    ? queueServices.find((service) => {
                          const nestedUserId =
                              typeof service.customer === 'object' && service.customer && 'user' in service.customer
                                  ? getNestedId(service.customer.user)
                                  : null;

                          return getNestedId(service.customer) === String(currentUser.id) || nestedUserId === String(currentUser.id);
                      })?.service_type?.name ?? null
                    : null,
        });
    });

    return queues;
}

function mapApiShop(
    shop: ApiShop,
    index: number,
    apiQueuesByShop: Map<string, ApiQueue[]>,
    apiQueueById: Map<string, ApiQueue>,
    queueIdsByShop: Map<string, string[]>,
    barbersById: Map<string, BarberInfo>,
    servicesByQueue: Map<string, ApiService[]>,
    todayKey: string,
    currentUser?: { id?: number; first_name?: string; last_name?: string; email?: string; telefone?: string; profile_picture?: string }
): ShopInfo {
    const fallback =
        SHOPS.find((item) => normalizeName(item.name) === normalizeName(shop.name)) ??
        SHOPS.find((item) => item.id === String(shop.id));
    const backendImage = shop.cover_photo?.trim();
    const shopId = String(shop.id);
    const queues = buildQueues(shopId, apiQueuesByShop, apiQueueById, queueIdsByShop, barbersById, servicesByQueue, todayKey, currentUser, fallback);

    return {
        id: shopId,
        name: shop.name?.trim() || fallback?.name || `Barbearia ${shop.id}`,
        distanceKm: fallback?.distanceKm ?? 0,
        rating: fallback?.rating,
        image: backendImage || fallback?.image || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length],
        hasCurrentAccount: buildHasCurrentAccount(shop, fallback),
        status: buildStatus(shop, fallback),
        description: fallback?.description ?? shop.other_reference?.trim() ?? undefined,
        location: buildLocation(shop, fallback),
        queues,
    };
}

export function useShops(): UseShopsResult {
    const { user, accessToken } = useAuth();
    const [shops, setShops] = useState<ShopInfo[]>([]);
    const [enterableShopIds, setEnterableShopIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [usingFallback, setUsingFallback] = useState(false);
    const [reloadToken, setReloadToken] = useState(0);

    useEffect(() => {
        const controller = new AbortController();

        async function loadShops() {
            setLoading(true);
            setError(null);

            try {
                const headers = {
                    Accept: 'application/json',
                };

                const [shopsResponse, queuesResponse, servicesResponse, barbersResponse] = await Promise.all([
                    fetch('/api/shops/', {
                        signal: controller.signal,
                        headers,
                    }),
                    fetch('/api/queues/', {
                        signal: controller.signal,
                        headers,
                    }),
                    fetch('/api/services/', {
                        signal: controller.signal,
                        headers,
                    }).catch(() => null),
                    fetch('/api/barbers/', {
                        signal: controller.signal,
                        headers: accessToken ? { ...headers, Authorization: `Bearer ${accessToken}` } : headers,
                    }).catch(() => null),
                ]);

                if (!shopsResponse.ok) {
                    throw new Error(`Falha ao carregar barbearias (${shopsResponse.status})`);
                }

                const shopsData = (await shopsResponse.json()) as ApiShop[];
                const queuesData = queuesResponse.ok
                    ? ((await queuesResponse.json()) as ApiQueue[])
                    : ([] as ApiQueue[]);
                const servicesData =
                    servicesResponse && servicesResponse.ok
                        ? ((await servicesResponse.json()) as ApiService[])
                        : ([] as ApiService[]);
                const barbersData =
                    barbersResponse && barbersResponse.ok
                        ? ((await barbersResponse.json()) as ApiBarberProfile[])
                        : ([] as ApiBarberProfile[]);

                if (!queuesResponse.ok) {
                    setError(`Falha parcial ao carregar filas (${queuesResponse.status})`);
                } else if (servicesResponse && !servicesResponse.ok) {
                    setError(`Falha parcial ao carregar servicos (${servicesResponse.status})`);
                } else if (barbersResponse && !barbersResponse.ok) {
                    setError(`Falha parcial ao carregar barbeiros (${barbersResponse.status})`);
                }

                const apiQueuesByShop = new Map<string, ApiQueue[]>();
                const apiQueueById = new Map<string, ApiQueue>();
                const todayKey = getCurrentMaputoDateKey();
                queuesData.forEach((queue) => {
                    apiQueueById.set(String(queue.id), queue);
                    const shopId =
                        getNestedId(queue.shop) ??
                        (typeof queue.shop === 'object' && queue.shop ? getNestedId((queue.shop as { id?: string | number }).id) : null);
                    if (!shopId) return;
                    const existing = apiQueuesByShop.get(shopId) ?? [];
                    existing.push(queue);
                    apiQueuesByShop.set(shopId, existing);
                });

                const barbersById = new Map<string, BarberInfo>();
                barbersData.forEach((barber, index) => {
                    const barberId = String(barber.id);
                    const rawUser = typeof barber.user === 'object' && barber.user ? barber.user : null;
                    const name = getDisplayName(
                        [
                            rawUser && 'first_name' in rawUser ? rawUser.first_name : null,
                            rawUser && 'last_name' in rawUser ? rawUser.last_name : null,
                        ],
                        (rawUser && 'username' in rawUser ? rawUser.username : null) ||
                            (rawUser && 'email' in rawUser ? rawUser.email?.split('@')[0] : null) ||
                            `Barbeiro ${index + 1}`
                    );

                    barbersById.set(barberId, {
                        id: barberId,
                        name,
                        specialty: 'Barbeiro',
                        status: 'offline',
                    });
                });

                const servicesByQueue = new Map<string, ApiService[]>();
                const queueIdsByShop = new Map<string, string[]>();
                servicesData
                    .slice()
                    .sort(compareByQueueJoinTime)
                    .forEach((service) => {
                    const serviceStatus = String(service.status || "").toUpperCase();
                    if (service.left_queue_at || service.finish_time || serviceStatus === "CANCELLED" || serviceStatus === "COMPLETED") return;
                    const queueId = getNestedId(service.queue);
                    if (!queueId) return;
                    const existing = servicesByQueue.get(queueId) ?? [];
                    existing.push(service);
                    servicesByQueue.set(queueId, existing);

                    const queueValue = typeof service.queue === 'object' && service.queue ? service.queue : null;
                    const shopId =
                        getNestedId(queueValue && 'shop' in queueValue ? queueValue.shop : null) ??
                        getNestedId(service.service_type?.barbershop);
                    if (!shopId) return;

                    if (queueValue && !apiQueueById.has(queueId)) {
                        apiQueueById.set(queueId, {
                            id: queueId,
                            name: 'name' in queueValue ? queueValue.name ?? null : null,
                            date: 'date' in queueValue ? queueValue.date ?? null : null,
                            status: 'status' in queueValue ? queueValue.status ?? null : null,
                            shop: 'shop' in queueValue ? queueValue.shop ?? null : null,
                            barber: 'barber' in queueValue ? queueValue.barber ?? null : null,
                        });
                    }

                    const shopQueueIds = queueIdsByShop.get(shopId) ?? [];
                    if (!shopQueueIds.includes(queueId)) {
                        shopQueueIds.push(queueId);
                        queueIdsByShop.set(shopId, shopQueueIds);
                    }
                });

                const accessibleShopIds = new Set<string>();
                const currentUserId = user?.id != null ? String(user.id) : null;
                const apiRole = String(user?.role || '').toUpperCase();

                if (canSeeAllShops(apiRole)) {
                    shopsData.forEach((shop) => accessibleShopIds.add(String(shop.id)));
                } else if (apiRole === 'SHOP_ADMIN' && currentUserId) {
                    shopsData.forEach((shop) => {
                        if (getNestedId(shop.manager) === currentUserId) {
                            accessibleShopIds.add(String(shop.id));
                        }
                    });
                } else if (apiRole === 'BARBER' && currentUserId) {
                    barbersData.forEach((barber) => {
                        if (getNestedId(barber.user) === currentUserId) {
                            const shopId = getNestedId(barber.shop);
                            if (shopId) accessibleShopIds.add(shopId);
                        }
                    });
                } else {
                    shopsData.forEach((shop) => accessibleShopIds.add(String(shop.id)));
                }

                setShops(
                    shopsData.map((shop, index) =>
                        mapApiShop(shop, index, apiQueuesByShop, apiQueueById, queueIdsByShop, barbersById, servicesByQueue, todayKey, user ?? undefined)
                    )
                );
                setEnterableShopIds(Array.from(accessibleShopIds));
                setUsingFallback(false);
            } catch (err) {
                if (controller.signal.aborted) return;

                setError(err instanceof Error ? err.message : 'Falha ao carregar barbearias');
                setShops(SHOPS);
                setEnterableShopIds(canSeeAllShops(user?.role) ? SHOPS.map((shop) => shop.id) : []);
                setUsingFallback(true);
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        void loadShops();

        return () => controller.abort();
    }, [accessToken, reloadToken, user]);

    return useMemo(
        () => ({
            shops,
            enterableShopIds,
            loading,
            error,
            usingFallback,
            reload: () => setReloadToken((current) => current + 1),
        }),
        [enterableShopIds, error, loading, shops, usingFallback]
    );
}
