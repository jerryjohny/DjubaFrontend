import { ReactNode, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Role, useRole } from '../../roleContext';
import './styles.css';

type Theme = 'dark' | 'light';

type NavItem = {
    to: string;
    label: string;
    icon: ReactNode;
};

const NAV_ITEMS: NavItem[] = [
    {
        to: '/home',
        label: 'Início',
        icon: (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 11.5 12 4l9 7.5v7.25a1.25 1.25 0 0 1-1.25 1.25H4.25A1.25 1.25 0 0 1 3 18.75V11.5z" />
                <path d="M9 20v-6h6v6" />
            </svg>
        ),
    },
    {
        to: '/queue',
        label: 'Minhas filas',
        icon: (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <circle cx="18" cy="18" r="2" />
            </svg>
        ),
    },
    {
        to: '/profile',
        label: 'Perfil',
        icon: (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c1-4 4-6 8-6s7 2 8 6" />
            </svg>
        ),
    },
];

export default function Layout() {
    const location = useLocation();
    const showNav = !location.pathname.startsWith('/shop') && location.pathname !== '/';
    const { role, setRole } = useRole();
    const [theme, setTheme] = useState<Theme>(() => {
        if (typeof window === 'undefined') return 'dark';
        const stored = window.localStorage.getItem('djuba-theme');
        const nextTheme = stored === 'light' ? 'light' : 'dark';
        if (typeof document !== 'undefined') {
            document.body.classList.toggle('theme-light', nextTheme === 'light');
            document.body.classList.toggle('theme-dark', nextTheme === 'dark');
        }
        return nextTheme;
    });

    useEffect(() => {
        if (typeof document === 'undefined') return;
        document.body.classList.toggle('theme-light', theme === 'light');
        document.body.classList.toggle('theme-dark', theme === 'dark');
        window.localStorage.setItem('djuba-theme', theme);
    }, [theme]);

    return (
        <div className="layout">
            <header className="layout__brandbar">
                <NavLink to="/home" className="layout__brandlink">
                    <div className="layout__logo-mark">
                        <img src="/djubalogo.png" alt="Logotipo Djuba" />
                    </div>
                    <div className="layout__logo-text">
                        <strong>Djuba</strong>
                        <span>Filas inteligentes</span>
                    </div>
                </NavLink>
                <div className="layout__actions">
                    <div className="layout__role-switch" role="group" aria-label="Selecionar perfil">
                        {([
                            { value: 'C', label: 'Cliente' },
                            { value: 'B', label: 'Barbeiro' },
                            { value: 'A', label: 'Admin' },
                        ] as { value: Role; label: string }[]).map((item) => (
                            <label
                                key={item.value}
                                className={`layout__role-pill${role === item.value ? ' layout__role-pill--active' : ''}`}
                            >
                                <input
                                    type="radio"
                                    name="role"
                                    value={item.value}
                                    checked={role === item.value}
                                    onChange={() => setRole(item.value)}
                                />
                                <span>{item.label}</span>
                            </label>
                        ))}
                    </div>
                    <span className="layout__tagline">Chegue sempre na hora</span>
                    <button
                        type="button"
                        className="layout__theme-toggle"
                        onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                        aria-label={`Ativar modo ${theme === 'dark' ? 'claro' : 'escuro'}`}
                    >
                        {theme === 'dark' ? (
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 1 0 9.79 9.79z" />
                            </svg>
                        ) : (
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="12" r="5" />
                                <path d="M12 2v2M12 20v2M4 12H2m20 0h-2M5.64 5.64 4.22 4.22m15.56 15.56-1.42-1.42M18.36 5.64l1.42-1.42M5.64 18.36 4.22 19.78" />
                            </svg>
                        )}
                    </button>
                </div>
            </header>

            <main className="layout__main">
                <Outlet />
            </main>

            {showNav && (
                <nav className="layout__bottomnav">
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                `layout__navlink${isActive ? ' layout__navlink--active' : ''}`
                            }
                            aria-label={item.label}
                            data-tooltip={item.label}
                            end={item.to === '/home'}
                        >
                            {item.icon}
                        </NavLink>
                    ))}
                </nav>
            )}
        </div>
    );
}
