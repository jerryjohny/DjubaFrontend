import { ReactNode, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import './styles.css';

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
    const navigate = useNavigate();
    const showNav = !location.pathname.startsWith('/shop');
    const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);

    const activeIndex = NAV_ITEMS.findIndex((item) => location.pathname.startsWith(item.to));

    const handleTouchStart = (event: React.TouchEvent) => {
        if (window.innerWidth > 768) return;
        const touch = event.touches[0];
        touchStart.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    };

    const handleTouchEnd = (event: React.TouchEvent) => {
        if (window.innerWidth > 768) return;
        const start = touchStart.current;
        if (!start) return;

        const touch = event.changedTouches[0];
        const deltaX = touch.clientX - start.x;
        const deltaY = Math.abs(touch.clientY - start.y);
        const elapsed = Date.now() - start.time;
        touchStart.current = null;

        if (Math.abs(deltaX) < 60 || deltaY > 80 || elapsed > 800) {
            return;
        }

        if (activeIndex === -1) return;

        const direction = deltaX < 0 ? 1 : -1;
        const nextIndex = activeIndex + direction;
        if (nextIndex < 0 || nextIndex >= NAV_ITEMS.length) return;
        navigate(NAV_ITEMS[nextIndex].to);
    };

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
                <span className="layout__tagline">Chegue sempre na hora</span>
            </header>

            <main className="layout__main" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
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
