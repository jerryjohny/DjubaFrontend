import { useMemo, useState } from "react";
import "./styles.css";

type Wallet = "emola" | "mpesa";

const INITIAL_USER = {
    name: "Docinho",
    email: "docinho@djuba.app",
    phone: "+258 84 123 4567",
    location: "Maputo, Mo\u00E7ambique",
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
    const [user, setUser] = useState(INITIAL_USER);
    const [editable, setEditable] = useState(INITIAL_USER);
    const [editing, setEditing] = useState(false);
    const [photo, setPhoto] = useState<string | null>(null);
    const [balance, setBalance] = useState(650);
    const [wallet, setWallet] = useState<Wallet>("emola");
    const [transactionId, setTransactionId] = useState("");
    const [error, setError] = useState("");

    const walletInfo = useMemo(() => WALLET_DETAILS[wallet], [wallet]);

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
            setError("Insira um c\u00F3digo v\u00E1lido");
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
            </header>

            <section className="profile__card">
                <h2>Dados pessoais</h2>
                <div className="profile__form">
                    <label>
                        Nome completo
                        <input
                            value={editable.name}
                            onChange={(e) => setEditable({ ...editable, name: e.target.value })}
                            disabled={!editing}
                        />
                    </label>
                    <label>
                        Email
                        <input
                            type="email"
                            value={editable.email}
                            onChange={(e) => setEditable({ ...editable, email: e.target.value })}
                            disabled={!editing}
                        />
                    </label>
                    <label>
                        Telefone
                        <input
                            value={editable.phone}
                            onChange={(e) => setEditable({ ...editable, phone: e.target.value })}
                            disabled={!editing}
                        />
                    </label>
                    <label>
                        {"Localiza\u00E7\u00E3o"}
                        <input
                            value={editable.location}
                            onChange={(e) => setEditable({ ...editable, location: e.target.value })}
                            disabled={!editing}
                        />
                    </label>
                </div>
                {editing && (
                    <button className="profile__save" onClick={saveProfile}>
                        {"Guardar altera\u00E7\u00F5es"}
                    </button>
                )}
            </section>

            <section className="profile__card">
                <h2>Recarregar conta</h2>
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
                        {`C\u00F3digo da transa\u00E7\u00E3o (${walletInfo.number})`}
                        <input
                            value={transactionId}
                            onChange={(e) => setTransactionId(e.target.value)}
                            placeholder="Insira o c\u00F3digo de confirma\u00E7\u00E3o"
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
