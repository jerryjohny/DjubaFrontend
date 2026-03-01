import { useEffect, useMemo, useState } from "react";
import { SHOPS } from "../../data/shops";
import { useRole } from "../../roleContext";
import "./styles.css";

type Wallet = "emola" | "mpesa";

const INITIAL_USER = {
    name: "Docinho",
    email: "docinho@djuba.app",
    phone: "+258 84 123 4567",
    location: "Maputo, Moçambique",
};

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

export default function Profile() {
    const { role } = useRole();
    const isAdmin = role === "A";
    const defaultCatalog = useMemo(
        () =>
            SHOPS.reduce<Record<string, { id: string; name: string; price: string }[]>>((acc, shop) => {
                acc[shop.id] = [
                    { id: `${shop.id}-c1`, name: "Corte clássico", price: "300 MT" },
                    { id: `${shop.id}-c2`, name: "Barba completa", price: "200 MT" },
                ];
                return acc;
            }, {}),
        []
    );
    const [user, setUser] = useState(INITIAL_USER);
    const [editable, setEditable] = useState(INITIAL_USER);
    const [editing, setEditing] = useState(false);
    const [photo, setPhoto] = useState<string | null>(null);
    const [balance, setBalance] = useState(650);
    const [wallet, setWallet] = useState<Wallet>("emola");
    const [transactionId, setTransactionId] = useState("");
    const [error, setError] = useState("");
    const [selectedShopId, setSelectedShopId] = useState(() => SHOPS[0]?.id ?? "");
    const [catalogDraft, setCatalogDraft] = useState<Record<string, { id: string; name: string; price: string }[]>>(
        defaultCatalog
    );
    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [shopDraft, setShopDraft] = useState(() => {
        const shop = SHOPS[0];
        return {
            id: shop?.id ?? "",
            name: shop?.name ?? "",
            location: shop?.location ?? "",
            description: shop?.description ?? "",
        };
    });

    useEffect(() => {
        const shop = SHOPS.find((s) => s.id === selectedShopId);
        if (!shop) return;
        setShopDraft({
            id: shop.id,
            name: shop.name,
            location: shop.location ?? "",
            description: shop.description ?? "",
        });
    }, [selectedShopId]);

    const selectedShop = useMemo(() => SHOPS.find((s) => s.id === selectedShopId), [selectedShopId]);
    const clientsToday = useMemo(
        () => selectedShop?.queues.reduce((sum, queue) => sum + queue.customers, 0) ?? 0,
        [selectedShop]
    );
    const queueBreakdown = useMemo(
        () =>
            selectedShop?.queues.map((queue) => ({
                name: queue.name,
                clients: queue.customers,
            })) ?? [],
        [selectedShop]
    );

    const WAIT_TYPES = ["Corte clássico", "Barba", "Penteado rápido", "Desenho/linha"];
    const WAIT_TIMES: Record<string, string> = {
        "Corte clássico": "~12 min",
        Barba: "~9 min",
        "Penteado rápido": "~7 min",
        "Desenho/linha": "~15 min",
    };
    const [waitType, setWaitType] = useState<string>(WAIT_TYPES[0]);

    useEffect(() => {
        setWaitType(WAIT_TYPES[0]);
    }, [selectedShopId]);

    const queueWaits = useMemo(
        () =>
            selectedShop?.queues.map((queue) => {
                const wait = WAIT_TIMES[waitType] ?? queue.waitEstimate;
                return { name: queue.name, wait };
            }) ?? [],
        [selectedShop, waitType]
    );

    const adminStats = useMemo(
        () => [
            { label: "Clientes hoje", value: `${clientsToday}`, hint: "+12% vs ontem" },
            { label: "Tempo médio", value: "", hint: "" },
            { label: "Filas ativas", value: `${selectedShop?.queues.length ?? 0}`, hint: "" },
        ],
        [clientsToday, selectedShop]
    );

    function toggleEditing() {
        if (editing) {
            setEditable(user);
        }
        setEditing(!editing);
    }

    function saveProfile() {
        setUser(editable);
        setEditing(false);
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
            setError("Insira um código válido");
            return;
        }
        setError("");
        setBalance((b) => b + 500);
        setTransactionId("");
        alert("Recarregado com sucesso!");
    }

    return (
        <div className="profile">
            <header className="profile__hero">
                <div className="profile__avatar">
                    {photo ? <img src={photo} alt="Foto do perfil" /> : <span>{user.name[0]}</span>}
                    <label className="profile__upload">
                        Alterar foto
                        <input type="file" accept="image/*" onChange={onPhotoChange} />
                    </label>
                </div>
                <div className="profile__summary">
                    <h1>{user.name}</h1>
                    <p>{user.location}</p>
                    <div className="profile__balance">Saldo: {balance} MTN</div>
                    <button className="profile__edit" onClick={toggleEditing}>
                        {editing ? "Cancelar" : "Editar dados"}
                    </button>
                </div>
                <div className="profile__details">
                    {[
                        { label: "Nome completo", key: "name", type: "text" },
                        { label: "Email", key: "email", type: "email" },
                        { label: "Telefone", key: "phone", type: "text" },
                        { label: "Bairro de residência", key: "location", type: "text" },
                    ].map((field) => {
                        const value = editable[field.key as keyof typeof editable] as string;
                        return editing ? (
                            <label key={field.key} className="profile__detail">
                                <span className="profile__detail-label">{field.label}</span>
                                <input
                                    type={field.type}
                                    value={value}
                                    onChange={(e) => setEditable({ ...editable, [field.key]: e.target.value })}
                                />
                                {field.key === "location" && (
                                    <button
                                        type="button"
                                        className="profile__save profile__save--inline profile__detail-action"
                                        onClick={saveProfile}
                                    >
                                        Guardar alterações
                                    </button>
                                )}
                            </label>
                        ) : (
                            <div key={field.key} className="profile__detail">
                                <span className="profile__detail-label">{field.label}</span>
                                <strong className="profile__detail-value">
                                    {user[field.key as keyof typeof user] as string}
                                </strong>
                            </div>
                        );
                    })}
                </div>
            </header>

            {isAdmin && (
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
                            >
                                {SHOPS.map((shop) => (
                                    <option key={shop.id} value={shop.id}>
                                        {shop.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="profile__dashboard">
                        {adminStats.map((stat) => {
                            const isClientes = stat.label === "Clientes hoje" && queueBreakdown.length > 0;
                            const isTempo = stat.label === "Tempo médio" && queueWaits.length > 0;
                            const isFilas = stat.label === "Filas ativas" && selectedShop?.queues.length;
                            return (
                                <div
                                    key={stat.label}
                                    className={`profile__stat${
                                        isClientes || isTempo || isFilas ? " profile__stat--with-breakdown" : ""
                                    }`}
                                >
                                    <div className="profile__stat-top">
                                        <p>{stat.label}</p>
                                        <strong>{stat.value}</strong>
                                        <span>{stat.hint}</span>
                                    </div>
                                    {isClientes && (
                                        <div className="profile__stat-breakdown">
                                            <ul className="profile__stat-list">
                                                {queueBreakdown.map((item) => (
                                                    <li key={item.name}>
                                                        <span className="profile__stat-queue">{item.name}</span>
                                                        <span className="profile__stat-chip">{item.clients}</span>
                                                    </li>
                                                ))}
                                            </ul>
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
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {isAdmin && (
                <section className="profile__card">
                    <h2 className="profile__section-title">Barbearia</h2>
                    <div className="profile__form profile__form--stacked">
                        <label>
                            Selecione a barbearia
                            <select value={selectedShopId} onChange={(e) => setSelectedShopId(e.target.value)}>
                                {SHOPS.map((shop) => (
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
                            Localização
                            <input
                                value={shopDraft.location}
                                onChange={(e) => setShopDraft((prev) => ({ ...prev, location: e.target.value }))}
                            />
                        </label>
                        <label>
                            Descrição
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
                    <div className="profile__catalog">
                        <div className="profile__catalog-header">
                            <h3>Catálogo</h3>
                        </div>
                        <div className="profile__catalog-list">
                            {(catalogDraft[selectedShopId] ?? []).map((item, idx) => (
                                <div key={item.id} className="profile__catalog-item">
                                    <div className="profile__catalog-fields">
                                        <label>
                                            Nome
                                            <input
                                                value={item.name}
                                                onChange={(e) =>
                                                    setCatalogDraft((prev) => {
                                                        const next = [...(prev[selectedShopId] ?? [])];
                                                        next[idx] = { ...item, name: e.target.value };
                                                        return { ...prev, [selectedShopId]: next };
                                                    })
                                                }
                                            />
                                        </label>
                                        <label>
                                            Preço
                                            <input
                                                value={item.price}
                                                onChange={(e) =>
                                                    setCatalogDraft((prev) => {
                                                        const next = [...(prev[selectedShopId] ?? [])];
                                                        next[idx] = { ...item, price: e.target.value };
                                                        return { ...prev, [selectedShopId]: next };
                                                    })
                                                }
                                            />
                                        </label>
                                    </div>
                                    <button
                                        type="button"
                                        className="profile__catalog-delete"
                                        onClick={() =>
                                            setCatalogDraft((prev) => {
                                                const next = (prev[selectedShopId] ?? []).filter((c) => c.id !== item.id);
                                                return { ...prev, [selectedShopId]: next };
                                            })
                                        }
                                        aria-label="Remover item"
                                    >
                                        Remover
                                    </button>
                                </div>
                            ))}
                            {!(catalogDraft[selectedShopId]?.length ?? 0) && (
                                <p className="profile__muted">Nenhum item cadastrado ainda.</p>
                            )}
                        </div>
                        <div className="profile__catalog-actions">
                            <button
                                type="button"
                                className="profile__save profile__save--ghost"
                                onClick={() =>
                                    setCatalogDraft((prev) => {
                                        const current = prev[selectedShopId] ?? [];
                                        const next = [
                                            ...current,
                                            {
                                                id: `${selectedShopId}-item-${current.length + 1}`,
                                                name: "Novo serviço",
                                                price: "0 MT",
                                            },
                                        ];
                                        return { ...prev, [selectedShopId]: next };
                                    })
                                }
                            >
                                + adicionar
                            </button>
                            <button
                                type="button"
                                className="profile__save"
                                onClick={() => window.alert?.("Catálogo atualizado (demo).")}
                            >
                                Guardar catálogo
                            </button>
                        </div>
                    </div>
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
                        Código da transação
                        <input
                            value={transactionId}
                            onChange={(e) => setTransactionId(e.target.value)}
                            placeholder="insira o código da transação"
                        />
                    </label>
                    {error && <div className="profile__error">{error}</div>}
                    <button type="submit" className="profile__save">
                        Validar e carregar
                    </button>
                </form>
            </section>
        </div>
    );
}
