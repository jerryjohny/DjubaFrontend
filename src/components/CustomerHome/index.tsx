import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShopInfo } from '../../data/shops';
import { useShops } from '../../hooks/useShops';
import './styles.css';

const STATUS_LABELS: Record<ShopInfo['status']['type'], string> = {
    open: 'Aberto',
    closingSoon: 'Aberto',
    closed: 'Fechado',
};

export default function CustomerHome() {
    const [q, setQ] = useState('');
    const navigate = useNavigate();
    const { shops, enterableShopIds, loading, error, usingFallback } = useShops();

    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        return term ? shops.filter((shop) => shop.name.toLowerCase().includes(term)) : shops;
    }, [q, shops]);

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

            {loading && <p className="chome__status">A carregar barbearias...</p>}
            {!loading && error && usingFallback && (
                <p className="chome__status chome__status--warning">
                    Nao foi possivel sincronizar com o backend. A mostrar lista local.
                </p>
            )}

            <div className="chome__list">
                {filtered.map((shop) => {
                    const canEnterShop = enterableShopIds.includes(shop.id);

                    return (
                        <div
                            key={shop.id}
                            className={`chome__card${canEnterShop ? '' : ' chome__card--locked'}`}
                            style={{
                                backgroundImage: `var(--card-overlay), url(${shop.image})`,
                            }}
                            role="button"
                            tabIndex={0}
                            aria-disabled={!canEnterShop}
                            onClick={() => {
                                if (!canEnterShop) return;
                                navigate(`/shop/${shop.id}`);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    if (!canEnterShop) return;
                                    navigate(`/shop/${shop.id}`);
                                }
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
                                    {(shop.distanceKm > 0 || typeof shop.rating === 'number') && (
                                        <span>
                                            {shop.distanceKm > 0 && `${shop.distanceKm.toFixed(1)} km`}
                                            {shop.distanceKm > 0 && typeof shop.rating === 'number' && ' | '}
                                            {typeof shop.rating === 'number' && `Nota ${shop.rating.toFixed(1)}`}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="chome__actions">
                                <button
                                    className="chome__btn-outline"
                                    disabled={!canEnterShop}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!canEnterShop) return;
                                        navigate(`/shop/${shop.id}`);
                                    }}
                                >
                                    Ver
                                </button>
                                <button
                                    className="chome__btn-primary"
                                    disabled={!canEnterShop}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!canEnterShop) return;
                                        navigate(`/shop/${shop.id}`);
                                    }}
                                >
                                    Entrar na fila
                                </button>
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
                    );
                })}
                {!loading && filtered.length === 0 && (
                    <p className="chome__status">Nenhuma barbearia encontrada.</p>
                )}
            </div>
        </div>
    );
}
