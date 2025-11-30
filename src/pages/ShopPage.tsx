import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SHOPS, QueueStatus, ShopInfo } from "../data/shops";
import "./ShopPage.css";

const QUEUE_STATUS_LABEL: Record<QueueStatus, string> = {
    open: "Fila aberta",
    closingSoon: "Fecha em breve",
    paused: "Fila pausada",
    closed: "Fechada",
};

const SAMPLE_CUSTOMERS = [
    { name: "Nuno T.", phone: "+258 82 123 4567", avatar: "https://i.pravatar.cc/100?img=5" },
    { name: "Sofia L.", phone: "+258 84 234 5678", avatar: "https://i.pravatar.cc/100?img=15" },
    { name: "Joana P.", phone: "+258 82 765 4321", avatar: "https://i.pravatar.cc/100?img=25" },
    { name: "Iuri C.", phone: "+258 86 345 9988", avatar: "https://i.pravatar.cc/100?img=35" },
    { name: "Bia M.", phone: "+258 84 777 0001", avatar: "https://i.pravatar.cc/100?img=45" },
];

const CATALOG = [
    { name: "Careca", price: "300 MT" },
    { name: "Juba", price: "450 MT" },
    { name: "Punk", price: "400 MT" },
    { name: "Punk para mulheres", price: "550 MT" },
    { name: "Barba", price: "200 MT" },
];

export default function ShopPage() {
    const { shopId } = useParams();
    const navigate = useNavigate();
    const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
    const [catalogOpen, setCatalogOpen] = useState(false);
    const queueRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const [canScrollRight, setCanScrollRight] = useState<Record<string, boolean>>({});

    const shop = useMemo<ShopInfo | undefined>(() => SHOPS.find((s) => s.id === shopId), [shopId]);

    const updateArrow = (queueId: string) => {
        const el = queueRefs.current[queueId];
        if (!el) return;
        const hasMore = el.scrollWidth - el.clientWidth - el.scrollLeft > 6;
        setCanScrollRight((prev) => {
            if (prev[queueId] === hasMore) return prev;
            return { ...prev, [queueId]: hasMore };
        });
    };

    useEffect(() => {
        if (!shop) return;
        shop.queues.forEach((queue) => {
            requestAnimationFrame(() => updateArrow(queue.id));
        });
    }, [shop]);

    if (!shop) {
        return (
            <div className="shop">
                <button className="shop__back" onClick={() => navigate(-1)}>
                    {"<"} Voltar
                </button>
                <p className="shop__empty">Barbearia nao encontrada.</p>
            </div>
        );
    }

    return (
        <div className="shop">
            <button className="shop__back" onClick={() => navigate(-1)}>
                {"<"} Voltar
            </button>

            <section
                className="shop__hero"
                style={{ backgroundImage: `url(${shop.image})` }}
            >
                <div className="shop__hero-overlay">
                    <div>
                        {shop.location && <p className="shop__location">{shop.location}</p>}
                        <h1>{shop.name}</h1>
                        <p className="shop__meta">
                            {shop.distanceKm.toFixed(1)} km | Nota {shop.rating?.toFixed(1)}
                        </p>
                    </div>
                    {shop.description && <p className="shop__description">{shop.description}</p>}
                    <div className="shop__catalog">
                        <button
                            className="shop__catalog-toggle"
                            type="button"
                            onClick={() => setCatalogOpen((prev) => !prev)}
                        >
                            Catálogo de cortes
                            <span>{catalogOpen ? "−" : "+"}</span>
                        </button>
                        {catalogOpen && (
                            <ul className="shop__catalog-list">
                                {CATALOG.map((item) => (
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
                <h2 className="shop__section-title">Filas disponiveis</h2>

                <div className="shop__queues">
                    {shop.queues.map((queue, index) => {
                        const mainBarber = index === 0 ? "Docinho" : queue.barbers[0]?.name ?? "Equipe";
                        const clients = Array.from({ length: queue.customers }, (_, i) => {
                            const base = SAMPLE_CUSTOMERS[i % SAMPLE_CUSTOMERS.length];
                            return { ...base, id: `${queue.id}-${i}` };
                        });

                        return (
                            <article key={queue.id} className="shop__queue-card">
                                <header className="shop__queue-header">
                                    <div>
                                        <h3>{`Fila ${index + 1} - ${mainBarber}`}</h3>
                                        <p className="shop__queue-meta">
                                            {queue.customers} clientes na fila | Espera estimada {queue.waitEstimate}
                                        </p>
                                    </div>
                                    <span className={`shop__queue-status shop__queue-status--${queue.status}`}>
                                        {QUEUE_STATUS_LABEL[queue.status]}
                                    </span>
                                </header>

                                <div
                                    className="shop__queue-avatars"
                                    ref={(el) => {
                                        queueRefs.current[queue.id] = el;
                                        if (el) updateArrow(queue.id);
                                    }}
                                    onScroll={() => updateArrow(queue.id)}
                                >
                                    {clients.length === 0 ? (
                                        <span className="shop__queue-empty">Fila vazia no momento</span>
                                    ) : (
                                        clients.map((client, i) => {
                                            const isCurrent = i === 0;
                                            const isTrade = i === 1; // simulate next client willing to trade
                                            const isExpanded = expandedClientId === client.id;
                                            return (
                                                <button
                                                    key={client.id}
                                                    type="button"
                                                    className={`shop__queue-avatar${isCurrent ? " shop__queue-avatar--current" : ""}${
                                                        isTrade ? " shop__queue-avatar--trade" : ""
                                                    }${isExpanded ? " shop__queue-avatar--expanded" : ""}`}
                                                    onClick={() =>
                                                        setExpandedClientId((prev) => (prev === client.id ? null : client.id))
                                                    }
                                                >
                                                    <img src={client.avatar} alt={`Cliente ${client.name}`} />
                                                    <div className="shop__queue-avatar-info">
                                                        <strong>{client.name}</strong>
                                                        <span>{client.phone}</span>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                    {canScrollRight[queue.id] && (
                                        <span className="shop__queue-arrow">{">>"}</span>
                                    )}
                                </div>

                                <div className="shop__slot">
                                    <div>
                                        <p>Próxima posição disponível</p>
                                        <strong>#{queue.customers + 1}</strong>
                                    </div>
                                    <button type="button" className="shop__slot-button">Entrar</button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}



