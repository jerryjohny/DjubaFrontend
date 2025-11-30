import { useMemo, useState } from "react";
import "./styles.css";

type QueueEntry = {
    id: string;
    shopName: string;
    position: number;
    ahead: string[];
    behind: string[];
};

const QUEUES: QueueEntry[] = [
    { id: "q1", shopName: "Barbearia Central", position: 3, ahead: ["João", "Marta"], behind: ["Tino", "Sara", "Ema", "Leo"] },
    { id: "q2", shopName: "Corte Fino", position: 1, ahead: [], behind: ["Mo", "Kiko", "Rui", "Pam"] },
    { id: "q3", shopName: "Bigode Dourado", position: 5, ahead: ["Rita", "Paulo", "Neto", "Ana"], behind: ["Lu", "Fredo"] },
];

const USER_NAME = "Você";

export default function Queue() {
    const [expandedBehind, setExpandedBehind] = useState<Record<string, boolean>>({});
    const [expandedPeople, setExpandedPeople] = useState<Record<string, boolean>>({});
    const sortedQueues = useMemo(() => [...QUEUES].sort((a, b) => a.position - b.position), []);
    const bestQueue = sortedQueues[0];

    return (
        <div className="queue">
            {bestQueue && (
                <div className="queue__summary">
                    <div>
                        <p>Melhor posição neste momento</p>
                        <strong>#{bestQueue.position}</strong>
                        <span>{bestQueue.shopName}</span>
                    </div>
                    <div className="queue__summary-meta">
                        {bestQueue.ahead.length} à frente · {bestQueue.behind.length} atrás
                    </div>
                </div>
            )}

            <div className="queue__strip">
                {sortedQueues.map((queue) => {
                    const people = [...queue.ahead, USER_NAME, ...queue.behind];
                    const yourIndex = queue.ahead.length;

                    return (
                        <div
                            key={queue.id}
                            className={`queue__card ${bestQueue?.id === queue.id ? "queue__card--best" : ""}`}
                        >
                            <div className="queue__header">
                                <div className="queue__title">{queue.shopName}</div>
                                <div className="queue__badge">#{queue.position}</div>
                                {bestQueue?.id === queue.id && <span className="queue__best">Melhor fila</span>}
                            </div>

                            <div className={`queue__people${expandedPeople[queue.id] ? " queue__people--expanded" : ""}`}>
                                {people.map((person, index) => {
                                    const isCurrent = index === 0;
                                    const isTrade = index === 1 && person !== USER_NAME;
                                    const isUser = index === yourIndex;
                                    const classes = [
                                        "queue__person",
                                        isCurrent && "queue__person--current",
                                        isTrade && "queue__person--trade",
                                        isUser && "queue__person--me",
                                    ]
                                        .filter(Boolean)
                                        .join(" ");

                                    return (
                                        <div key={`${queue.id}-${index}`} className={classes}>
                                            <span>{person}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            {people.length > 6 && (
                                <button
                                    className="queue__people-toggle"
                                    onClick={() =>
                                        setExpandedPeople((prev) => ({
                                            ...prev,
                                            [queue.id]: !prev[queue.id],
                                        }))
                                    }
                                >
                                    {expandedPeople[queue.id] ? "Recolher fila" : "Ver todos na fila"}
                                </button>
                            )}

                            <div className="queue__section">
                                <div className="queue__label">À frente de si</div>
                                {queue.ahead.length === 0 ? (
                                    <div className="queue__text">É o próximo!</div>
                                ) : (
                                    <div className="queue__chips">
                                        {queue.ahead.map((name, i) => (
                                            <span key={i} className="queue__chip">
                                                {name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="queue__section">
                                <div className="queue__label">Atrás de si</div>
                                <div className="queue__info">
                                    <span>{queue.behind.length} pessoas</span>
                                    {!expandedBehind[queue.id] ? (
                                        <button
                                            className="queue__link"
                                            onClick={() => setExpandedBehind({ ...expandedBehind, [queue.id]: true })}
                                        >
                                            Ver nomes
                                        </button>
                                    ) : (
                                        <button
                                            className="queue__link"
                                            onClick={() =>
                                                setExpandedBehind((prev) => {
                                                    const copy = { ...prev };
                                                    delete copy[queue.id];
                                                    return copy;
                                                })
                                            }
                                        >
                                            Esconder
                                        </button>
                                    )}
                                </div>
                                {expandedBehind[queue.id] && (
                                    <div className="queue__chips">
                                        {queue.behind.map((name, i) => (
                                            <span key={i} className="queue__chip">
                                                {name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="queue__hint">Revise suas filas e escolha a melhor posição.</div>
        </div>
    );
}