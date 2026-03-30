import { useState } from 'react';
import './styles.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../authContext';

declare global {
    interface Window {
        google?: {
            accounts?: {
                oauth2?: {
                    initTokenClient: (config: {
                        client_id: string;
                        scope: string;
                        callback: (response: { access_token?: string; error?: string; error_description?: string }) => void;
                        error_callback?: (error: { type: string }) => void;
                    }) => {
                        requestAccessToken: () => void;
                    };
                };
            };
        };
    }
}

export default function Auth() {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [busy, setBusy] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);

    const [loginEmail, setLoginEmail] = useState('');
    const [loginPass, setLoginPass] = useState('');

    const [fullName, setFullName] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [regPass, setRegPass] = useState('');
    const [confirm, setConfirm] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const navigate = useNavigate();
    const { login, googleLogin, register } = useAuth();

    async function submitLogin() {
        setBusy(true);
        setAuthError(null);
        try {
            await login(loginEmail, loginPass);
            navigate('/home');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Falha ao autenticar';
            setAuthError(message);
        } finally {
            setBusy(false);
        }
    }

    function validateRegister() {
        const nextErrors: Record<string, string> = {};
        if (!fullName.trim()) nextErrors.fullName = 'Nome completo e obrigatorio';
        if (!regEmail.includes('@')) nextErrors.email = 'Email invalido';
        if (!phone) nextErrors.phone = 'Telefone invalido';
        if (regPass.length < 8) nextErrors.password = 'Min 8 caracteres';
        if (regPass !== confirm) nextErrors.confirm = 'As palavras-passe nao coincidem';
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    }

    async function submitRegister() {
        if (!validateRegister()) return;
        setBusy(true);
        setAuthError(null);
        try {
            await register({ fullName, email: regEmail, password: regPass });
            navigate('/home');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Falha ao registar';
            setAuthError(message);
        } finally {
            setBusy(false);
        }
    }

    function submitGoogle() {
        setAuthError(null);

        const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
        if (!clientId) {
            setAuthError('REACT_APP_GOOGLE_CLIENT_ID nao esta definido');
            return;
        }

        if (!window.google?.accounts?.oauth2) {
            setAuthError('Google Identity Services nao foi carregado');
            return;
        }

        setBusy(true);
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'openid email profile',
            callback: async (response: { access_token?: string; error?: string; error_description?: string }) => {
                if (response.error || !response.access_token) {
                    setAuthError(response.error_description || response.error || 'Google nao devolveu credenciais');
                    setBusy(false);
                    return;
                }

                try {
                    await googleLogin({ accessToken: response.access_token });
                    navigate('/home');
                } catch (err) {
                    const message = err instanceof Error ? err.message : 'Falha ao autenticar com Google';
                    setAuthError(message);
                } finally {
                    setBusy(false);
                }
            },
            error_callback: () => {
                setAuthError('Falha ao abrir o popup do Google');
                setBusy(false);
            },
        });

        tokenClient.requestAccessToken();
    }

    return (
        <div className="auth">
            <div className="auth__card">
                <div className="auth__brand">Djuba</div>
                <div className="auth__subtitle">
                    {mode === 'login' ? 'Faca login para continuar' : 'Registo de cliente'}
                </div>

                {mode === 'login' ? (
                    <>
                        {authError && <div className="auth__error">{authError}</div>}
                        <label className="auth__label">Email</label>
                        <input className="auth__input" type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />

                        <label className="auth__label">Password</label>
                        <input className="auth__input" type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} />

                        <button className="auth__button auth__button--primary" onClick={submitLogin} disabled={busy}>Entrar</button>

                        <div className="auth__divider"><span>ou</span></div>
                        <button className="auth__button auth__button--google" onClick={submitGoogle} disabled={busy}>
                            Continuar com Google
                        </button>

                        <p className="auth__switch">
                            Ainda nao tem conta?{' '}
                            <button className="auth__link" onClick={() => setMode('register')}>Registe-se</button>
                        </p>
                    </>
                ) : (
                    <>
                        {authError && <div className="auth__error">{authError}</div>}
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

                        <div className="auth__divider"><span>ou</span></div>
                        <button className="auth__button auth__button--google" onClick={submitGoogle} disabled={busy}>
                            Criar com Google
                        </button>

                        <p className="auth__switch">
                            Ja tem conta?{' '}
                            <button className="auth__link" onClick={() => setMode('login')}>Iniciar sessao</button>
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
