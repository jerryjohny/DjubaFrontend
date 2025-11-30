import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SHOPS, ShopInfo } from '../../data/shops';
import './styles.css';

const STATUS_LABELS: Record<ShopInfo['status']['type'], string> = {
    open: 'Aberto',
    closingSoon: 'Aberto',
    closed: 'Fechado',
};

export default function CustomerHome() {
    const [q, setQ] = useState('');
    const navigate = useNavigate();

    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        return term ? SHOPS.filter((shop) => shop.name.toLowerCase().includes(term)) : SHOPS;
    }, [q]);

    return (
        <div className="chome">
            <div className="chome__searchrow">
                <input
                    className="chome__input"
                    placeholder="Procurar barbearia pelo nome"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
                <button className="chome__button">Procurar</button>
            </div>

            <div className="chome__list">
                {filtered.map((shop) => (
                    <div
                        key={shop.id}
                        className="chome__card"
                        style={{
                            backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.2), rgba(0,0,0,0.65)), url(${shop.image})`,
                        }}
                    >
                        <div className="chome__card-content">
                            <div>
                                <div className="chome__title">{shop.name}</div>
                                <div className="chome__meta">
                                    {shop.location && (
                                        <>
                                            <span>{shop.location}</span>
                                            <br />
                                        </>
                                    )}
                                    <span>
                                        {shop.distanceKm.toFixed(1)} km | Nota {shop.rating?.toFixed(1)}
                                    </span>
                                </div>
                            </div>

                            <div className="chome__actions">
                                <button className="chome__btn-outline" onClick={() => navigate(`/shop/${shop.id}`)}>
                                    Ver
                                </button>
                                <button className="chome__btn-primary">Entrar na fila</button>
                            </div>
                        </div>

                        <div className={`chome__flag chome__flag--${shop.status.type}`}>
                            <div className="chome__flag-text">
                                <div className="chome__flag-status">{STATUS_LABELS[shop.status.type]}</div>
                                {shop.status.type === 'closed' ? (
                                    <div className="chome__flag-time">Abre amanha</div>
                                ) : (
                                    <div className="chome__flag-time">Fecha as {shop.status.time}</div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
