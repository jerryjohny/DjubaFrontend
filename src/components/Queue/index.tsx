import { useEffect, useMemo, useRef, useState } from "react";
import { SHOPS, QueueInfo, QueueStatus, ShopInfo } from "../../data/shops";
import "./styles.css";

type ClientInfo = {
    id: string;
    name: string;
    phone: string;
    avatar: string;
    isUser?: boolean;
};

type MyQueueEntry = {
    shopId: string;
    queueId: string;
    position: number;
};

type QueueCardInfo = {
    entry: MyQueueEntry;
    shop: ShopInfo;
    queue: QueueInfo;
    clients: ClientInfo[];
    userIndex: number;
    cardId: string;
};

const QUEUE_STATUS_LABEL: Record<QueueStatus, string> = {
    open: "Fila aberta",
    closingSoon: "Fecha em breve",
    paused: "Fila pausada",
    closed: "Fechada",
};

const SAMPLE_CUSTOMERS: ClientInfo[] = [
    { id: "c1", name: "Nuno T.", phone: "+258 82 123 4567", avatar: "https://i.pravatar.cc/100?img=5" },
    { id: "c2", name: "Sofia L.", phone: "+258 84 234 5678", avatar: "https://i.pravatar.cc/100?img=15" },
    { id: "c3", name: "Joana P.", phone: "+258 82 765 4321", avatar: "https://i.pravatar.cc/100?img=25" },
    { id: "c4", name: "Iuri C.", phone: "+258 86 345 9988", avatar: "https://i.pravatar.cc/100?img=35" },
    { id: "c5", name: "Bia M.", phone: "+258 84 777 0001", avatar: "https://i.pravatar.cc/100?img=45" },
    { id: "c6", name: "Carlos V.", phone: "+258 84 110 2233", avatar: "https://i.pravatar.cc/100?img=55" },
];

const USER_PROFILE: ClientInfo = {
    id: "user",
    name: "EU",
    phone: "+258 82 900 1234",
    avatar: "https://i.pravatar.cc/100?img=68",
    isUser: true,
};

const MY_QUEUES: MyQueueEntry[] = [
    { shopId: "s1", queueId: "q1", position: 3 },
    { shopId: "s1", queueId: "q2", position: 1 },
    { shopId: "s2", queueId: "q3", position: 2 },
];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const createClients = (queue: QueueInfo, entry: MyQueueEntry, offset: number) => {
    const othersCount = Math.max(queue.customers - 1, 0);
    const others = Array.from({ length: othersCount }, (_, index) => {
        const sample = SAMPLE_CUSTOMERS[(index + offset) % SAMPLE_CUSTOMERS.length];
        return {
            ...sample,
            id: `${queue.id}-client-${offset}-${index}`,
        };
    });

    const insertIndex = clamp(entry.position - 1, 0, others.length);
    others.splice(insertIndex, 0, {
        ...USER_PROFILE,
        id: `${queue.id}-me`,
    });

    return others;
};

export default function Queue() {
    const uniqueQueues = useMemo(() => {
        const map: Record<string, MyQueueEntry> = {};
        MY_QUEUES.forEach((entry) => {
            const existing = map[entry.shopId];
            if (!existing || entry.position < existing.position) {
                map[entry.shopId] = entry;
            }
        });
        return Object.values(map);
    }, []);

    const queueCards = useMemo<QueueCardInfo[]>(() => {
        return uniqueQueues
            .map((entry, entryIndex) => {
                const shop = SHOPS.find((s) => s.id === entry.shopId);
                if (!shop) return null;
                const queue = shop.queues.find((q) => q.id === entry.queueId);
                if (!queue) return null;

                const clients = createClients(queue, entry, entryIndex * 2);
                const userIndex = clients.findIndex((client) => client.isUser);

                return {
                    entry,
                    shop,
                    queue,
                    clients,
                    userIndex,
                    cardId: `${shop.id}-${queue.id}`,
                };
            })
            .filter((value): value is QueueCardInfo => Boolean(value));
    }, [uniqueQueues]);

    const bestQueue = useMemo(() => {
        return queueCards.reduce<QueueCardInfo | null>((best, current) => {
            if (!best) return current;
            return current.entry.position < best.entry.position ? current : best;
        }, null);
    }, [queueCards]);

    const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
    const [userSwapOffers, setUserSwapOffers] = useState<Record<string, boolean>>({});
    const [canScrollRight, setCanScrollRight] = useState<Record<string, boolean>>({});
    const queueRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

    if (queueCards.length === 0) {
        return (
            <div className="queue queue--empty">
                <p>{"Você ainda não está inscrito em nenhuma fila."}</p>
            </div>
        );
    }

    return (
        <div className="queue">
            {bestQueue && (
                <div className="queue__summary">
                    <div>
                        <p>{"Melhor posição neste momento"}</p>
                        <strong>#{bestQueue.entry.position}</strong>
                        <span>{bestQueue.shop.name}</span>
                    </div>
                    <div className="queue__summary-meta">
                        {bestQueue.entry.position === 1
                            ? "É a sua vez"
                            : bestQueue.entry.position - 1 > 0
                                ? `${bestQueue.entry.position - 1} pessoas à frente`
                                : "Você é o próximo"}
                    </div>
                </div>
            )}

            <div className="queue__cards">
                {queueCards.map((card, index) => {
                    const barberName = card.queue.barbers[0]?.name ?? "Equipe";
                    const cardKey = card.cardId;
                    const swapActive = Boolean(userSwapOffers[cardKey]);

                    return (
                        <article
                            key={cardKey}
                            className={`queue__card ${bestQueue?.cardId === cardKey ? "queue__card--highlight" : ""}`}
                        >
                            <header className="queue__card-header">
                                <div>
                                    <p className="queue__shop">{card.shop.name}</p>
                                    <h3>{`Fila ${index + 1} - ${barberName}`}</h3>
                                    <p className="queue__card-meta">
                                        {card.entry.position === 1
                                            ? `É a sua vez nesta fila | Espera estimada ${card.queue.waitEstimate}`
                                            : `Você está na posição #${card.entry.position} | Espera estimada ${card.queue.waitEstimate}`}
                                    </p>
                                    <p className="queue__card-meta queue__card-meta--secondary">
                                        {`${card.queue.customers} clientes no total`}
                                    </p>
                                </div>
                                <span className={`queue__status queue__status--${card.queue.status}`}>
                                    {QUEUE_STATUS_LABEL[card.queue.status]}
                                </span>
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
                                        const isCurrent = clientIndex === 0;
                                        const isTrade = clientIndex === 1 && !client.isUser;
                                        const isMe = client.isUser;
                                        const isExpanded = expandedClientId === client.id;
                                        const avatarClasses = [
                                            "queue__avatar",
                                            isCurrent && "queue__avatar--current",
                                            isTrade && "queue__avatar--trade",
                                            isMe && "queue__avatar--me",
                                            isExpanded && "queue__avatar--expanded",
                                        ]
                                            .filter(Boolean)
                                            .join(" ");

                                        return (
                                            <button
                                                key={client.id}
                                                type="button"
                                                className={avatarClasses}
                                                onClick={() =>
                                                    setExpandedClientId((prev) => (prev === client.id ? null : client.id))
                                                }
                                            >
                                                <img src={client.avatar} alt={`Cliente ${client.name}`} />
                                                <span className="queue__avatar-name">{client.name}</span>
                                                <div className="queue__avatar-info">
                                                    <strong>{client.name}</strong>
                                                    <span>{client.phone}</span>
                                                    {isMe && isExpanded && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className={`queue__swap-btn${
                                                                    swapActive ? " queue__swap-btn--active" : ""
                                                                }`}
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    setUserSwapOffers((prev) => ({
                                                                        ...prev,
                                                                        [cardKey]: !swapActive,
                                                                    }));
                                                                }}
                                                            >
                                                                {swapActive ? "Troca disponível" : "Disponibilizar troca"}
                                                            </button>
                                                            {!isCurrent && (
                                                                <button
                                                                    type="button"
                                                                    className="queue__swap-btn queue__swap-btn--exit"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        window.alert?.("Você saiu da fila.");
                                                                    }}
                                                                >
                                                                    Sair da fila
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                    {isTrade && isExpanded && (
                                                        <button
                                                            type="button"
                                                            className="queue__swap-btn queue__swap-btn--request"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                window.alert?.("Solicitação de troca enviada.");
                                                            }}
                                                        >
                                                            Solicitar troca
                                                        </button>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                                {canScrollRight[cardKey] && <span className="queue__avatars-arrow">{">>"}</span>}
                            </div>
                        </article>
                    );
                })}
            </div>

            <div className="queue__hint">{"Revise suas filas e escolha a melhor posição para ser atendido."}</div>
        </div>
    );
}
