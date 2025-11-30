import { useState } from 'react';
import './styles.css';
import { useNavigate } from 'react-router-dom';


type LoginPayload = { email: string; password: string };
type RegisterPayload = { fullName: string; email: string; phone: string; password: string };

type Props = {
    onLogin?: (p: LoginPayload) => void;
    onRegister?: (p: RegisterPayload) => void;
    onGoogle?: () => void | Promise<void>;
};

export default function Auth({ onLogin, onRegister, onGoogle }: Props) {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [busy, setBusy] = useState(false);

    const [loginEmail, setLoginEmail] = useState('');
    const [loginPass, setLoginPass] = useState('');

    const [fullName, setFullName] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [regPass, setRegPass] = useState('');
    const [confirm, setConfirm] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const navigate = useNavigate();

    function submitLogin() {
        onLogin?.({ email: loginEmail, password: loginPass });
        navigate('/home');
    }

    function validateRegister() {
        const e: Record<string, string> = {};
        if (!fullName.trim()) e.fullName = 'Nome completo é obrigatório';
        if (!regEmail.includes('@')) e.email = 'Email inválido';
        if (!phone) e.phone = 'Telefone inválido';
        if (regPass.length < 8) e.password = 'Min 8 caracteres';
        if (regPass !== confirm) e.confirm = 'As palavras-passe não coincidem';
        setErrors(e);
        return Object.keys(e).length === 0;
    }

    function submitRegister() {
        if (!validateRegister()) return;
        onRegister?.({ fullName, email: regEmail, phone, password: regPass });
    }

    async function googleClick() {
        setBusy(true);
        try { await onGoogle?.(); } finally { setBusy(false); }
    }

    return (
        <div className="auth">
            <div className="auth__card">
                <div className="auth__brand">✂ Djuba</div>
                <div className="auth__subtitle">
                    {mode === 'login' ? 'Faça login para continuar' : 'Registo de cliente'}
                </div>

                {mode === 'login' ? (
                    <>
                        <label className="auth__label">Email</label>
                        <input className="auth__input" type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />

                        <label className="auth__label">Password</label>
                        <input className="auth__input" type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} />

                        <button className="auth__button auth__button--primary" onClick={submitLogin} disabled={busy}>Entrar</button>

                        <div className="auth__divider"><span>ou</span></div>

                        <button className="auth__button auth__button--google" onClick={googleClick} disabled={busy}>
                            Entrar com Google
                        </button>

                        <p className="auth__switch">
                            Ainda não tem conta?{' '}
                            <button className="auth__link" onClick={() => setMode('register')}>Registe-se</button>
                        </p>
                    </>
                ) : (
                    <>
                        <label className="auth__label">Nome completo</label>
                        <input className="auth__input" value={fullName} onChange={e => setFullName(e.target.value)} />
                        {errors.fullName && <div className="auth__error">{errors.fullName}</div>}

                        <label className="auth__label">Email</label>
                        <input className="auth__input" type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                        {errors.email && <div className="auth__error">{errors.email}</div>}

                        <label className="auth__label">Telefone</label>
                        <input className="auth__input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
                        {errors.phone && <div className="auth__error">{errors.phone}</div>}

                        <label className="auth__label">Palavra-passe</label>
                        <input className="auth__input" type="password" value={regPass} onChange={e => setRegPass(e.target.value)} />
                        {errors.password && <div className="auth__error">{errors.password}</div>}

                        <label className="auth__label">Confirmar palavra-passe</label>
                        <input className="auth__input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} />
                        {errors.confirm && <div className="auth__error">{errors.confirm}</div>}

                        <button className="auth__button auth__button--primary" onClick={submitRegister} disabled={busy}>Criar conta</button>

                        <p className="auth__switch">
                            Já tem conta?{' '}
                            <button className="auth__link" onClick={() => setMode('login')}>Iniciar sessão</button>
                        </p>

                        <div className="auth__divider"><span>ou</span></div>

                        <button className="auth__button auth__button--google" onClick={googleClick} disabled={busy}>
                            Preencher com Google
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
