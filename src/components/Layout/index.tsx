import { ReactNode, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../authContext';
import { useCurrentAccount } from '../../hooks/useCurrentAccount';
import './styles.css';

type Theme = 'dark' | 'light';

type NavItem = {
    to: string;
    label: string;
    icon: ReactNode;
};

type ApiNotificationTransaction = {
    id: number | string;
    tx_type?: string | null;
    transaction_group?: string | null;
    status?: string | null;
    amount?: number | string | null;
    description?: string | null;
    created_at?: string | null;
    beneficiary_account?: { id?: number | string | null } | null;
    service?: { id?: number | string | null } | number | string | null;
    created_by?: {
        id?: number | string | null;
        first_name?: string | null;
        last_name?: string | null;
        email?: string | null;
    } | null;
};

type ApiNotificationService = {
    id: number | string;
    status?: string | null;
    joined_queue_at?: string | null;
    left_queue_at?: string | null;
    start_time?: string | null;
    finish_time?: string | null;
    paid_via_account?: boolean | null;
    manual_payment_confirmed?: boolean | null;
    refund_confirmed?: boolean | null;
    queue?:
        | {
              id?: number | string | null;
              shop?:
                  | {
                        id?: number | string | null;
                        name?: string | null;
                        manager?: { id?: number | string | null } | number | string | null;
                    }
                  | number
                  | string
                  | null;
              barber?:
                  | {
                        id?: number | string | null;
                        user?:
                            | {
                                  id?: number | string | null;
                              }
                            | number
                            | string
                            | null;
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
              name?: string | null;
              price?: number | string | null;
          }
        | null;
    customer?:
        | {
              id?: number | string | null;
              first_name?: string | null;
              last_name?: string | null;
              email?: string | null;
          }
        | number
        | string
        | null;
};

type CustomerNotification = {
    id: string;
    title: string;
    detail: string;
    createdLabel: string;
    createdAt: string;
};

const API_BASE = process.env.REACT_APP_API_BASE || '/api';

function getNestedId(value: unknown): string | null {
    if (value == null) return null;
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (typeof value === 'object' && 'id' in value) {
        const nested = (value as { id?: string | number | null }).id;
        return nested == null ? null : String(nested);
    }
    return null;
}

function parseAmount(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

function formatNotificationMoney(value: number) {
    return `${value.toLocaleString('pt-PT')} MZN`;
}

function formatNotificationMoment(value?: string | null) {
    if (!value) return 'Agora';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Agora';
    return date.toLocaleString('pt-MZ', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function buildNotification(tx: ApiNotificationTransaction): CustomerNotification {
    const type = String(tx.tx_type || '').toUpperCase();
    const amount = parseAmount(tx.amount);

    if (type === 'REFUND') {
        return {
            id: String(tx.id),
            title: 'Reembolso recebido',
            detail: `${formatNotificationMoney(amount)} foram devolvidos para a sua conta.`,
            createdLabel: formatNotificationMoment(tx.created_at),
            createdAt: String(tx.created_at || ''),
        };
    }

    return {
        id: String(tx.id),
        title: 'Nova entrada na conta',
        detail: tx.description?.trim() || `${formatNotificationMoney(amount)} foram creditados na sua conta.`,
        createdLabel: formatNotificationMoment(tx.created_at),
        createdAt: String(tx.created_at || ''),
    };
}

function buildPersonLabel(
    person:
        | {
              first_name?: string | null;
              last_name?: string | null;
              email?: string | null;
          }
        | null
        | undefined
) {
    const fullName = [person?.first_name?.trim(), person?.last_name?.trim()].filter(Boolean).join(' ').trim();
    if (fullName) return fullName;
    if (person?.first_name?.trim()) return person.first_name.trim();
    if (person?.email?.trim()) return person.email.trim();
    return 'Cliente';
}

function getServiceStatus(service: ApiNotificationService) {
    const raw = String(service.status || '').toUpperCase();
    if (raw) return raw;
    if (service.left_queue_at) return 'CANCELLED';
    if (service.finish_time) return 'COMPLETED';
    if (service.start_time) return 'IN_SERVICE';
    return 'QUEUED';
}

function leftBeforeService(service: ApiNotificationService) {
    const status = getServiceStatus(service);
    return status === 'CANCELLED' || Boolean(service.left_queue_at);
}

const NAV_ITEMS: NavItem[] = [
    {
        to: '/home',
        label: 'Início',
        icon: (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 11.5 12 4l9 7.5v7.25a1.25 1.25 0 0 1-1.25 1.25H4.25A1.25 1.25 0 0 1 3 18.75V11.5z" />
                <path d="M9 20v-6h6v6" />
            </svg>
        ),
    },
    {
        to: '/queue',
        label: 'Minhas filas',
        icon: (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <circle cx="18" cy="18" r="2" />
            </svg>
        ),
    },
    {
        to: '/profile',
        label: 'Perfil',
        icon: (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c1-4 4-6 8-6s7 2 8 6" />
            </svg>
        ),
    },
];

export default function Layout() {
    const location = useLocation();
    const showNav = !location.pathname.startsWith('/shop') && location.pathname !== '/';
    const { user, logout, accessToken, authFetch } = useAuth();
    const { account } = useCurrentAccount();
    const displayName = user?.first_name?.trim() || 'Utilizador';
    const userRole = String(user?.role || '').toUpperCase();
    const isCustomer = userRole === 'CUSTOMER';
    const isShopAdmin = userRole === 'SHOP_ADMIN';
    const isBarber = userRole === 'BARBER';
    const canSeeNotifications = isCustomer || isShopAdmin || isBarber;
    const customerAccountId = account?.id == null ? null : String(account.id);
    const [theme, setTheme] = useState<Theme>(() => {
        if (typeof window === 'undefined') return 'dark';
        const stored = window.localStorage.getItem('djuba-theme');
        const nextTheme = stored === 'light' ? 'light' : 'dark';
        if (typeof document !== 'undefined') {
            document.body.classList.toggle('theme-light', nextTheme === 'light');
            document.body.classList.toggle('theme-dark', nextTheme === 'dark');
        }
        return nextTheme;
    });
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [notificationsLoading, setNotificationsLoading] = useState(false);
    const [notificationsError, setNotificationsError] = useState('');
    const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
    const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
    const [userMenuOpen, setUserMenuOpen] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined' || !user?.id) {
            setReadNotificationIds([]);
            return;
        }

        try {
            const stored = window.localStorage.getItem(`djuba-read-notifications:${user.id}`);
            const parsed = stored ? (JSON.parse(stored) as string[]) : [];
            setReadNotificationIds(Array.isArray(parsed) ? parsed.map(String) : []);
        } catch {
            setReadNotificationIds([]);
        }
    }, [user?.id]);

    useEffect(() => {
        if (!accessToken || !canSeeNotifications || (isCustomer && !customerAccountId)) {
            setNotifications([]);
            setNotificationsError('');
            setNotificationsLoading(false);
            return;
        }

        let active = true;

        const loadNotifications = async () => {
            if (active) {
                setNotificationsLoading(true);
                setNotificationsError('');
            }

            try {
                if (isCustomer) {
                    const response = await authFetch(`${API_BASE}/account-transactions/`, {
                        headers: {
                            Accept: 'application/json',
                        },
                    });

                    if (!response.ok) {
                        throw new Error(`Falha ao carregar notificacoes (${response.status})`);
                    }

                    const data = (await response.json()) as ApiNotificationTransaction[];
                    if (!active) return;

                    const nextNotifications = data
                        .filter((tx) => getNestedId(tx.beneficiary_account) === customerAccountId)
                        .filter((tx) => String(tx.status || '').toUpperCase() === 'COMPLETED')
                        .sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')))
                        .map(buildNotification);

                    setNotifications(nextNotifications);
                    return;
                }

                const headers = {
                    Accept: 'application/json',
                };
                const [servicesResponse, transactionsResponse] = await Promise.all([
                    authFetch(`${API_BASE}/services/`, { headers }),
                    authFetch(`${API_BASE}/account-transactions/`, { headers }),
                ]);

                if (!servicesResponse.ok) {
                    throw new Error(`Falha ao carregar servicos (${servicesResponse.status})`);
                }

                if (!transactionsResponse.ok) {
                    throw new Error(`Falha ao carregar notificacoes (${transactionsResponse.status})`);
                }

                const servicesData = (await servicesResponse.json()) as ApiNotificationService[];
                const transactionsData = (await transactionsResponse.json()) as ApiNotificationTransaction[];
                if (!active) return;

                const currentUserId = user?.id == null ? null : String(user.id);
                const relevantServices = (Array.isArray(servicesData) ? servicesData : []).filter((service) => {
                    if (!currentUserId) return false;
                    if (isShopAdmin) {
                        return getNestedId(typeof service.queue === 'object' && service.queue ? service.queue.shop : null) != null
                            && getNestedId(
                                typeof service.queue === 'object' &&
                                    service.queue &&
                                    typeof service.queue.shop === 'object' &&
                                    service.queue.shop
                                    ? service.queue.shop.manager
                                    : null
                            ) === currentUserId;
                    }

                    if (isBarber) {
                        return (
                            getNestedId(
                                typeof service.queue === 'object' &&
                                    service.queue &&
                                    typeof service.queue.barber === 'object' &&
                                    service.queue.barber
                                    ? service.queue.barber.user
                                    : null
                            ) === currentUserId
                        );
                    }

                    return false;
                });

                const serviceMap = new Map(relevantServices.map((service) => [String(service.id), service]));
                const refundGroups = new Set(
                    (Array.isArray(transactionsData) ? transactionsData : [])
                        .filter((tx) => String(tx.tx_type || '').toUpperCase() === 'REFUND')
                        .map((tx) => String(tx.transaction_group || ''))
                        .filter(Boolean)
                );

                const nextNotifications: CustomerNotification[] = [];

                relevantServices.forEach((service) => {
                    if (service.paid_via_account || service.manual_payment_confirmed || leftBeforeService(service)) return;

                    const customer =
                        typeof service.customer === 'object' && service.customer ? service.customer : null;
                    const serviceName = service.service_type?.name?.trim() || `Servico #${service.id}`;
                    const amount = parseAmount(service.service_type?.price);

                    nextNotifications.push({
                        id: `manual-${service.id}`,
                        title: 'Pagamento manual pendente',
                        detail: `${buildPersonLabel(customer)} aguarda confirmacao de ${formatNotificationMoney(amount)} em ${serviceName}.`,
                        createdLabel: formatNotificationMoment(service.joined_queue_at),
                        createdAt: String(service.joined_queue_at || ''),
                    });
                });

                (Array.isArray(transactionsData) ? transactionsData : []).forEach((tx) => {
                    if (String(tx.tx_type || '').toUpperCase() !== 'SERVICE_PAYMENT') return;
                    if (refundGroups.has(String(tx.transaction_group || ''))) return;

                    const serviceId = getNestedId(tx.service);
                    if (!serviceId) return;

                    const linkedService = serviceMap.get(serviceId);
                    if (!linkedService) return;
                    if (!leftBeforeService(linkedService) || linkedService.start_time || linkedService.finish_time || linkedService.refund_confirmed) {
                        return;
                    }

                    const customer =
                        typeof linkedService.customer === 'object' && linkedService.customer ? linkedService.customer : null;
                    const serviceName = linkedService.service_type?.name?.trim() || `Servico #${linkedService.id}`;
                    const amount = parseAmount(tx.amount);

                    nextNotifications.push({
                        id: `refund-${tx.id}`,
                        title: 'Reembolso pendente',
                        detail: `${buildPersonLabel(customer)} saiu da fila; confirme o reembolso de ${formatNotificationMoney(amount)} em ${serviceName}.`,
                        createdLabel: formatNotificationMoment(tx.created_at),
                        createdAt: String(tx.created_at || ''),
                    });
                });

                nextNotifications.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
                setNotifications(nextNotifications);
            } catch (error) {
                if (!active) return;
                setNotifications([]);
                setNotificationsError(error instanceof Error ? error.message : 'Falha ao carregar notificacoes');
            } finally {
                if (active) {
                    setNotificationsLoading(false);
                }
            }
        };

        void loadNotifications();
        const intervalId = window.setInterval(() => {
            void loadNotifications();
        }, 60000);

        return () => {
            active = false;
            window.clearInterval(intervalId);
        };
    }, [accessToken, authFetch, canSeeNotifications, customerAccountId, isBarber, isCustomer, isShopAdmin, user?.id]);

    useEffect(() => {
        if (!notificationsOpen || typeof window === 'undefined' || !user?.id || notifications.length === 0) return;

        const nextIds = Array.from(new Set([...readNotificationIds, ...notifications.map((item) => item.id)]));
        if (nextIds.length === readNotificationIds.length) return;

        setReadNotificationIds(nextIds);
        window.localStorage.setItem(`djuba-read-notifications:${user.id}`, JSON.stringify(nextIds));
    }, [notifications, notificationsOpen, readNotificationIds, user?.id]);

    const unseenNotifications = useMemo(
        () => notifications.filter((item) => !readNotificationIds.includes(item.id)),
        [notifications, readNotificationIds]
    );

    useEffect(() => {
        if (typeof document === 'undefined') return;
        document.body.classList.toggle('theme-light', theme === 'light');
        document.body.classList.toggle('theme-dark', theme === 'dark');
        window.localStorage.setItem('djuba-theme', theme);
    }, [theme]);

    useEffect(() => {
        setNotificationsOpen(false);
        setUserMenuOpen(false);
    }, [location.pathname]);

    return (
        <div className="layout">
            <header className="layout__brandbar">
                <NavLink to="/home" className="layout__brandlink">
                    <div className="layout__logo-mark">
                        <img src="/djubalogo.png" alt="Logotipo Djuba" />
                    </div>
                    <div className="layout__logo-text">
                        <strong>Djuba</strong>
                        <span>Filas inteligentes</span>
                    </div>
                </NavLink>
                <div className="layout__actions">
                    <span className="layout__tagline">Chegue sempre na hora</span>
                    {accessToken && canSeeNotifications && (
                        <div className="layout__notifications layout__notifications--desktop">
                            <button
                                type="button"
                                className={`layout__notification-trigger${notificationsOpen ? ' layout__notification-trigger--active' : ''}`}
                                onClick={() => setNotificationsOpen((current) => !current)}
                                aria-label="Abrir notificacoes"
                            >
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M12 3a4 4 0 0 0-4 4v1.2c0 .88-.29 1.73-.82 2.44L5.4 13.2A2 2 0 0 0 7 16.5h10a2 2 0 0 0 1.6-3.3l-1.78-2.56A4.2 4.2 0 0 1 16 8.2V7a4 4 0 0 0-4-4Z" />
                                    <path d="M9.5 18a2.5 2.5 0 0 0 5 0" />
                                </svg>
                                {unseenNotifications.length > 0 && (
                                    <span className="layout__notification-badge">
                                        {unseenNotifications.length > 9 ? '9+' : unseenNotifications.length}
                                    </span>
                                )}
                            </button>
                            {notificationsOpen && (
                                <div className="layout__notification-panel" role="dialog" aria-label="Notificacoes">
                                    <div className="layout__notification-header">
                                        <strong>Notificacoes</strong>
                                        <button
                                            type="button"
                                            className="layout__notification-close"
                                            onClick={() => setNotificationsOpen(false)}
                                        >
                                            x
                                        </button>
                                    </div>
                                    {notificationsLoading ? (
                                        <p className="layout__notification-empty">A carregar notificacoes...</p>
                                    ) : notificationsError ? (
                                        <p className="layout__notification-empty">{notificationsError}</p>
                                    ) : notifications.length === 0 ? (
                                        <p className="layout__notification-empty">Sem novas notificacoes no momento.</p>
                                    ) : (
                                        <div className="layout__notification-list">
                                            {notifications.map((item) => (
                                                <article
                                                    key={item.id}
                                                    className={`layout__notification-item${
                                                        readNotificationIds.includes(item.id) ? '' : ' layout__notification-item--new'
                                                    }`}
                                                >
                                                    <strong>{item.title}</strong>
                                                    <p>{item.detail}</p>
                                                    <span>{item.createdLabel}</span>
                                                </article>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    <div className="layout__action-menu layout__action-menu--desktop">
                        <button
                            type="button"
                            className="layout__theme-toggle"
                            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                            aria-label={`Ativar modo ${theme === 'dark' ? 'claro' : 'escuro'}`}
                        >
                            {theme === 'dark' ? (
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 1 0 9.79 9.79z" />
                                </svg>
                            ) : (
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <circle cx="12" cy="12" r="5" />
                                    <path d="M12 2v2M12 20v2M4 12H2m20 0h-2M5.64 5.64 4.22 4.22m15.56 15.56-1.42-1.42M18.36 5.64l1.42-1.42M5.64 18.36 4.22 19.78" />
                                </svg>
                            )}
                        </button>
                    </div>
                    {accessToken && (
                        <div className="layout__user-menu">
                            <button
                                type="button"
                                className={`layout__user-trigger${userMenuOpen ? ' layout__user-trigger--active' : ''}`}
                                onClick={() => {
                                    setUserMenuOpen((current) => !current);
                                    setNotificationsOpen(false);
                                }}
                                aria-label="Abrir menu do perfil"
                                aria-expanded={userMenuOpen}
                            >
                                {user?.profile_picture ? (
                                    <img src={user.profile_picture} alt={displayName} className="layout__user-avatar" />
                                ) : (
                                    <span className="layout__user-avatar layout__user-avatar--fallback">
                                        {displayName.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </button>
                            {userMenuOpen && (
                                <div className="layout__user-panel" role="dialog" aria-label="Menu do perfil">
                                    <div className="layout__user-panel-avatar">
                                        {user?.profile_picture ? (
                                            <img src={user.profile_picture} alt={displayName} className="layout__user-avatar" />
                                        ) : (
                                            <span className="layout__user-avatar layout__user-avatar--fallback">
                                                {displayName.charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <NavLink
                                        to="/profile"
                                        className={({ isActive }) =>
                                            `layout__user-name${isActive ? ' layout__user-name--active' : ''}`
                                        }
                                        onClick={() => setUserMenuOpen(false)}
                                    >
                                        {displayName}
                                    </NavLink>
                                    <button
                                        type="button"
                                        className="layout__logout"
                                        onClick={() => {
                                            setUserMenuOpen(false);
                                            logout();
                                        }}
                                    >
                                        Sair
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </header>
            <div className="layout__mobile-utility">
                <span className="layout__mobile-tagline">Chegue sempre na hora</span>
                <div className="layout__mobile-utility-actions">
                    {accessToken && canSeeNotifications && (
                        <div className="layout__notifications layout__notifications--mobile">
                            <button
                                type="button"
                                className={`layout__notification-trigger${notificationsOpen ? ' layout__notification-trigger--active' : ''}`}
                                onClick={() => {
                                    setNotificationsOpen((current) => !current);
                                    setUserMenuOpen(false);
                                }}
                                aria-label="Abrir notificacoes"
                            >
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M12 3a4 4 0 0 0-4 4v1.2c0 .88-.29 1.73-.82 2.44L5.4 13.2A2 2 0 0 0 7 16.5h10a2 2 0 0 0 1.6-3.3l-1.78-2.56A4.2 4.2 0 0 1 16 8.2V7a4 4 0 0 0-4-4Z" />
                                    <path d="M9.5 18a2.5 2.5 0 0 0 5 0" />
                                </svg>
                                {unseenNotifications.length > 0 && (
                                    <span className="layout__notification-badge">
                                        {unseenNotifications.length > 9 ? '9+' : unseenNotifications.length}
                                    </span>
                                )}
                            </button>
                            {notificationsOpen && (
                                <div className="layout__notification-panel" role="dialog" aria-label="Notificacoes">
                                    <div className="layout__notification-header">
                                        <strong>Notificacoes</strong>
                                        <button
                                            type="button"
                                            className="layout__notification-close"
                                            onClick={() => setNotificationsOpen(false)}
                                        >
                                            x
                                        </button>
                                    </div>
                                    {notificationsLoading ? (
                                        <p className="layout__notification-empty">A carregar notificacoes...</p>
                                    ) : notificationsError ? (
                                        <p className="layout__notification-empty">{notificationsError}</p>
                                    ) : notifications.length === 0 ? (
                                        <p className="layout__notification-empty">Sem novas notificacoes no momento.</p>
                                    ) : (
                                        <div className="layout__notification-list">
                                            {notifications.map((item) => (
                                                <article
                                                    key={item.id}
                                                    className={`layout__notification-item${
                                                        readNotificationIds.includes(item.id) ? '' : ' layout__notification-item--new'
                                                    }`}
                                                >
                                                    <strong>{item.title}</strong>
                                                    <p>{item.detail}</p>
                                                    <span>{item.createdLabel}</span>
                                                </article>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    <div className="layout__action-menu layout__action-menu--mobile">
                        <button
                            type="button"
                            className="layout__theme-toggle"
                            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                            aria-label={`Ativar modo ${theme === 'dark' ? 'claro' : 'escuro'}`}
                        >
                            {theme === 'dark' ? (
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 1 0 9.79 9.79z" />
                                </svg>
                            ) : (
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <circle cx="12" cy="12" r="5" />
                                    <path d="M12 2v2M12 20v2M4 12H2m20 0h-2M5.64 5.64 4.22 4.22m15.56 15.56-1.42-1.42M18.36 5.64l1.42-1.42M5.64 18.36 4.22 19.78" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <main className="layout__main">
                <Outlet />
            </main>

            {showNav && (
                <nav className="layout__bottomnav">
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                `layout__navlink${isActive ? ' layout__navlink--active' : ''}`
                            }
                            aria-label={item.label}
                            data-tooltip={item.label}
                            end={item.to === '/home'}
                        >
                            {item.icon}
                        </NavLink>
                    ))}
                </nav>
            )}
        </div>
    );
}
