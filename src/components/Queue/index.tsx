import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../authContext";
import { QueueClientInfo, QueueInfo, QueueStatus, ShopInfo } from "../../data/shops";
import { useShops } from "../../hooks/useShops";
import "./styles.css";

type QueueCardInfo = {
    shop: ShopInfo;
    queue: QueueInfo;
    clients: Array<QueueClientInfo & { isCurrentUser: boolean }>;
    cardId: string;
    serviceId: string;
    position: number;
};

type ClientModalState = {
    mode: "preview" | "self";
    client: QueueClientInfo & { isCurrentUser: boolean };
    card: QueueCardInfo;
};

const QUEUE_STATUS_LABEL: Record<QueueStatus, string> = {
    open: "Fila aberta",
    closingSoon: "Fecha em breve",
    paused: "Fila pausada",
    closed: "Fechada",
    inactive: "Nao iniciada",
};

function toRequestId(value: string) {
    return /^\d+$/.test(value) ? Number(value) : value;
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

export default function Queue() {
    const { user: authUser, accessToken, authFetch } = useAuth();
    const { shops, loading, error, reload } = useShops();
    const [activeModal, setActiveModal] = useState<ClientModalState | null>(null);
    const [userSwapOffers, setUserSwapOffers] = useState<Record<string, boolean>>({});
    const [canScrollRight, setCanScrollRight] = useState<Record<string, boolean>>({});
    const [actionError, setActionError] = useState("");
    const [actionSuccess, setActionSuccess] = useState("");
    const [leavingServiceId, setLeavingServiceId] = useState<string | null>(null);
    const queueRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const queueCards = useMemo<QueueCardInfo[]>(() => {
        const currentUserId = authUser?.id != null ? String(authUser.id) : null;

        return shops
            .flatMap((shop) =>
                shop.queues
                    .filter((queue) => queue.currentUserServiceId)
                    .map((queue) => {
                        const clients = (queue.clients ?? []).map((client) => ({
                            ...client,
                            isCurrentUser: currentUserId != null && client.id === currentUserId,
                        }));

                        return {
                            shop,
                            queue,
                            clients,
                            cardId: `${shop.id}-${queue.id}`,
                            serviceId: queue.currentUserServiceId || "",
                            position: queue.currentUserPosition || Math.max(1, queue.customers),
                        };
                    })
            )
            .sort((left, right) => left.position - right.position);
    }, [authUser, shops]);

    const bestQueue = queueCards[0] ?? null;

    const updateArrow = (queueId: string) => {
        const element = queueRefs.current[queueId];
        if (!element) return;
        const hasMore = element.scrollWidth - element.clientWidth - element.scrollLeft > 6;
        setCanScrollRight((prev) => {
            if (prev[queueId] === hasMore) return prev;
            return { ...prev, [queueId]: hasMore };
        });
    };

    useEffect(() => {
        queueCards.forEach((card) => {
            requestAnimationFrame(() => updateArrow(card.cardId));
        });
    }, [queueCards]);

    function openClientModal(card: QueueCardInfo, client: QueueCardInfo["clients"][number]) {
        setActiveModal({
            mode: client.isCurrentUser ? "self" : "preview",
            client,
            card,
        });
    }

    function closeClientModal() {
        if (leavingServiceId) return;
        setActiveModal(null);
    }

    async function leaveQueue(card: QueueCardInfo) {
        if (!accessToken || !card.serviceId) {
            setActionError("Nao foi possivel validar a sua sessao.");
            return;
        }

        setLeavingServiceId(card.serviceId);
        setActionError("");
        setActionSuccess("");

        try {
            const response = await authFetch(`/api/services/${toRequestId(card.serviceId)}/leave/`, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                },
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || `Falha ao sair da fila (${response.status})`);
            }

            setActiveModal(null);
            setActionSuccess(`Saiu da ${card.queue.name} com sucesso.`);
            reload();
        } catch (err) {
            setActionError(err instanceof Error ? err.message : "Falha ao sair da fila");
        } finally {
            setLeavingServiceId(null);
        }
    }

    if (loading) {
        return (
            <div className="queue queue--empty">
                <p>A carregar as suas filas...</p>
            </div>
        );
    }

    if (error && queueCards.length === 0) {
        return (
            <div className="queue queue--empty">
                <p>{error}</p>
            </div>
        );
    }

    if (queueCards.length === 0) {
        return (
            <div className="queue queue--empty">
                <p>Voce ainda nao esta inscrito em nenhuma fila.</p>
            </div>
        );
    }

    return (
        <div className="queue">
            {actionSuccess && <div className="queue__flash queue__flash--success">{actionSuccess}</div>}
            {actionError && <div className="queue__flash queue__flash--error">{actionError}</div>}

            {bestQueue && (
                <div className="queue__summary">
                    <div>
                        <p>Melhor posicao neste momento</p>
                        <strong>#{bestQueue.position}</strong>
                        <span>{bestQueue.shop.name}</span>
                    </div>
                    <div className="queue__summary-meta">
                        {bestQueue.position === 1
                            ? "E a sua vez"
                            : bestQueue.position - 1 > 0
                              ? `${bestQueue.position - 1} pessoas a frente`
                              : "Voce e o proximo"}
                    </div>
                </div>
            )}

            <div className="queue__cards">
                {queueCards.map((card) => {
                    const barberName = card.queue.barbers[0]?.name ?? null;
                    const queueTitle = barberName ? `${card.queue.name} - ${barberName}` : card.queue.name;
                    const queueDateLabel = formatQueueDate(card.queue.date);
                    const swapActive = Boolean(userSwapOffers[card.serviceId]);

                    return (
                        <article key={card.cardId} className={`queue__card ${bestQueue?.cardId === card.cardId ? "queue__card--highlight" : ""}`}>
                            <header className="queue__card-header">
                                <div>
                                    <p className="queue__shop">{card.shop.name}</p>
                                    <h3>{queueTitle}</h3>
                                    {queueDateLabel && <p className="queue__card-date">{queueDateLabel}</p>}
                                    <p className="queue__card-meta">
                                        {card.position === 1
                                            ? `E a sua vez nesta fila | Espera estimada ${card.queue.waitEstimate}`
                                            : `Voce esta na posicao #${card.position} | Espera estimada ${card.queue.waitEstimate}`}
                                    </p>
                                    <p className="queue__card-meta queue__card-meta--secondary">
                                        {`${card.queue.customers} clientes no total${card.queue.currentUserServiceName ? ` | ${card.queue.currentUserServiceName}` : ""}`}
                                    </p>
                                </div>
                                <span className={`queue__status queue__status--${card.queue.status}`}>{QUEUE_STATUS_LABEL[card.queue.status]}</span>
                            </header>

                            <div
                                className="queue__avatars"
                                ref={(element) => {
                                    queueRefs.current[card.cardId] = element;
                                    if (element) updateArrow(card.cardId);
                                }}
                                onScroll={() => updateArrow(card.cardId)}
                            >
                                {card.clients.length === 0 ? (
                                    <span className="queue__avatars-empty">Fila vazia no momento</span>
                                ) : (
                                    card.clients.map((client, clientIndex) => {
                                        const avatarClasses = [
                                            "queue__avatar",
                                            clientIndex === 0 && "queue__avatar--current",
                                            client.isCurrentUser && "queue__avatar--me",
                                        ]
                                            .filter(Boolean)
                                            .join(" ");

                                        return (
                                            <button
                                                key={client.id}
                                                type="button"
                                                className={avatarClasses}
                                                onClick={() => openClientModal(card, client)}
                                            >
                                                <img src={client.avatar} alt={`Cliente ${client.name}`} />
                                                <span className="queue__avatar-name">{client.name}</span>
                                            </button>
                                        );
                                    })
                                )}
                                {canScrollRight[card.cardId] && <span className="queue__avatars-arrow">{">>"}</span>}
                            </div>

                            {swapActive && <div className="queue__swap-state">A sua posicao esta disponivel para troca.</div>}
                        </article>
                    );
                })}
            </div>

            <div className="queue__hint">Revise as suas filas e toque na foto para ver detalhes ou acoes.</div>

            {activeModal && (
                <div className="queue__modal-backdrop" onClick={closeClientModal}>
                    <div
                        className={`queue__modal${activeModal.mode === "self" ? " queue__modal--split" : ""}`}
                        onClick={(event) => event.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                    >
                        <button type="button" className="queue__modal-close" onClick={closeClientModal}>
                            x
                        </button>

                        {activeModal.mode === "preview" ? (
                            <div className="queue__modal-preview">
                                <div className="queue__modal-avatar">
                                    <img src={activeModal.client.avatar} alt={activeModal.client.name} />
                                </div>
                                <strong>{activeModal.client.name}</strong>
                                <span>{activeModal.client.phone}</span>
                                <small>{`${activeModal.card.shop.name} - ${activeModal.card.queue.name}`}</small>
                            </div>
                        ) : (
                            <div className="queue__modal-split">
                                <div className="queue__modal-media">
                                    <div className="queue__modal-avatar queue__modal-avatar--large">
                                        <img src={activeModal.client.avatar} alt={activeModal.client.name} />
                                    </div>
                                    <strong>{activeModal.client.name}</strong>
                                    <span>{activeModal.client.phone}</span>
                                    <small>{`Posicao atual #${activeModal.card.position}`}</small>
                                </div>

                                <div className="queue__modal-actions-pane">
                                    <h3>Gerir a minha posicao</h3>
                                    <p>{`${activeModal.card.shop.name} - ${activeModal.card.queue.name}`}</p>

                                    <button
                                        type="button"
                                        className={`queue__action-btn${userSwapOffers[activeModal.card.serviceId] ? " queue__action-btn--active" : ""}`}
                                        onClick={() =>
                                            setUserSwapOffers((prev) => ({
                                                ...prev,
                                                [activeModal.card.serviceId]: !prev[activeModal.card.serviceId],
                                            }))
                                        }
                                    >
                                        {userSwapOffers[activeModal.card.serviceId] ? "Minha posicao disponibilizada" : "Disponibilizar minha posicao"}
                                    </button>

                                    <button
                                        type="button"
                                        className="queue__action-btn queue__action-btn--danger"
                                        onClick={() => void leaveQueue(activeModal.card)}
                                        disabled={leavingServiceId === activeModal.card.serviceId}
                                    >
                                        {leavingServiceId === activeModal.card.serviceId ? "A sair..." : "Abandonar fila"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
