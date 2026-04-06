import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Role } from './roleContext';

export type AuthUser = {
    id: number;
    email: string;
    username?: string;
    first_name?: string;
    last_name?: string;
    telefone?: string;
    bairro?: string;
    profile_picture?: string;
    role?: string;
};

type UpdateUserPayload = Partial<Pick<AuthUser, 'first_name' | 'last_name' | 'email' | 'telefone' | 'bairro'>>;

type AuthContextValue = {
    user: AuthUser | null;
    role: Role | null;
    accessToken: string | null;
    refreshToken: string | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    googleLogin: (payload: { idToken?: string; accessToken?: string }) => Promise<void>;
    register: (payload: RegisterPayload) => Promise<void>;
    updateUser: (payload: UpdateUserPayload) => Promise<AuthUser>;
    logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// In dev we rely on CRA proxy (package.json "proxy") so a relative base avoids CORS issues.
const API_BASE = process.env.REACT_APP_API_BASE || '/api';
const STORAGE_KEY = 'djuba-auth';

type StoredAuth = {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
    role: Role;
};

export type RegisterPayload = {
    fullName: string;
    email: string;
    telefone: string;
    password: string;
    role?: Role;
};

function mapRole(apiRole?: string): Role | null {
    if (!apiRole) return null;
    const upper = apiRole.toUpperCase();
    if (upper.includes('ADMIN')) return 'A';
    if (upper.includes('BARBER')) return 'B';
    if (upper.includes('CUSTOMER')) return 'C';
    return null;
}

async function fetchJson(url: string, options: RequestInit = {}) {
    try {
        const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

        const res = await fetch(url, {
            ...options,
            headers: {
                Accept: 'application/json',
                ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
                ...(options.headers || {}),
            },
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || res.statusText);
        }
        return res.json();
    } catch (err) {
        if (err instanceof TypeError) {
            // Network / CORS / server down
            throw new Error('Não foi possível contactar o servidor. Confirme se o backend está a correr em ' + API_BASE);
        }
        throw err;
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [role, setRole] = useState<Role | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            setLoading(false);
            return;
        }
        try {
            const parsed: StoredAuth = JSON.parse(stored);
            setUser(parsed.user);
            setRole(parsed.role);
            setAccessToken(parsed.accessToken);
            setRefreshToken(parsed.refreshToken);
        } catch {
            window.localStorage.removeItem(STORAGE_KEY);
        } finally {
            setLoading(false);
        }
    }, []);

    const persist = useCallback((next: StoredAuth | null) => {
        if (!next) {
            window.localStorage.removeItem(STORAGE_KEY);
            return;
        }
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        setRole(null);
        setAccessToken(null);
        setRefreshToken(null);
        persist(null);
    }, [persist]);

    const storeAuth = useCallback(
        (access: string, refresh: string, authUser: AuthUser) => {
            const nextRole = mapRole(authUser.role) ?? 'C';
            const nextAuth: StoredAuth = {
                accessToken: access,
                refreshToken: refresh,
                user: authUser,
                role: nextRole,
            };

            setUser(nextAuth.user);
            setRole(nextAuth.role);
            setAccessToken(access);
            setRefreshToken(refresh);
            persist(nextAuth);
        },
        [persist]
    );

    const fetchAndSetUser = useCallback(
        async (access: string, refresh: string, email: string) => {
            const users = await fetchJson(`${API_BASE}/users/`, {
                headers: { Authorization: `Bearer ${access}` },
            });
            const matched: AuthUser | undefined = (users as AuthUser[]).find(
                (u) => u.email?.toLowerCase() === email.toLowerCase()
            );
            const apiUser = matched ?? null;
            storeAuth(access, refresh, apiUser ?? { id: 0, email });
        },
        [storeAuth]
    );

    const login = useCallback(
        async (email: string, password: string) => {
            const tokenData = await fetchJson(`${API_BASE}/token/`, {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            });

            const access = tokenData.access as string;
            const refresh = tokenData.refresh as string;

            await fetchAndSetUser(access, refresh, email);
        },
        [fetchAndSetUser]
    );

    const register = useCallback(
        async ({ fullName, email, telefone, password, role: desiredRole }: RegisterPayload) => {
            const [first_name, ...rest] = fullName.trim().split(' ');
            const last_name = rest.join(' ') || first_name;
            const username = email;
            const roleToSend = desiredRole ? (desiredRole === 'A' ? 'ADMIN' : desiredRole === 'B' ? 'BARBER' : 'CUSTOMER') : 'CUSTOMER';

            await fetchJson(`${API_BASE}/users/`, {
                method: 'POST',
                body: JSON.stringify({
                    username,
                    first_name,
                    last_name,
                    email,
                    telefone,
                    role: roleToSend,
                    password,
                }),
            });

            // auto-login after registration
            await login(email, password);
        },
        [login]
    );

    const googleLogin = useCallback(
        async ({ idToken, accessToken }: { idToken?: string; accessToken?: string }) => {
            if (!idToken && !accessToken) {
                throw new Error('Credencial Google em falta');
            }

            const data = await fetchJson(`${API_BASE}/auth/google/`, {
                method: 'POST',
                body: JSON.stringify({
                    ...(idToken ? { id_token: idToken } : {}),
                    ...(accessToken ? { access_token: accessToken } : {}),
                }),
            });

            const access = data.access as string;
            const refresh = data.refresh as string;
            const authUser = data.user as AuthUser | undefined;

            if (!access || !refresh || !authUser) {
                throw new Error('Resposta invÃ¡lida do login com Google');
            }

            await fetchAndSetUser(access, refresh, authUser.email);
        },
        [fetchAndSetUser]
    );

    const updateUser = useCallback(
        async (payload: UpdateUserPayload) => {
            if (!user?.id || !accessToken || !refreshToken) {
                throw new Error('Sessao invalida');
            }

            const updatedUser = (await fetchJson(`${API_BASE}/users/${user.id}/`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify(payload),
            })) as AuthUser;

            const mergedUser: AuthUser = { ...user, ...updatedUser };
            const nextRole = mapRole(mergedUser.role) ?? role ?? 'C';
            const nextAuth: StoredAuth = {
                accessToken,
                refreshToken,
                user: mergedUser,
                role: nextRole,
            };

            setUser(mergedUser);
            setRole(nextRole);
            persist(nextAuth);

            return mergedUser;
        },
        [accessToken, persist, refreshToken, role, user]
    );

    const value = useMemo<AuthContextValue>(
        () => ({
            user,
            role,
            accessToken,
            refreshToken,
            loading,
            login,
            googleLogin,
            register,
            updateUser,
            logout,
        }),
        [user, role, accessToken, refreshToken, loading, login, googleLogin, register, updateUser, logout]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
