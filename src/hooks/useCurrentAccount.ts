import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../authContext";

type ApiAccountOwner = {
    id?: number | string | null;
};

type ApiAccount = {
    id: number | string;
    owner_type?: string | null;
    user?: ApiAccountOwner | null;
    shop?: ApiAccountOwner | null;
    balance?: number | string | null;
    currency?: string | null;
    is_active?: boolean | null;
};

const API_BASE = process.env.REACT_APP_API_BASE || "/api";

function getNestedId(value: unknown): string | null {
    if (value == null) return null;
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (typeof value === "object" && "id" in value) {
        const nested = (value as { id?: string | number | null }).id;
        return nested == null ? null : String(nested);
    }
    return null;
}

function parseBalance(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

export function useCurrentAccount() {
    const { user, accessToken, authFetch } = useAuth();
    const [accounts, setAccounts] = useState<ApiAccount[]>([]);
    const [account, setAccount] = useState<ApiAccount | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!user?.id || !accessToken) {
            setAccounts([]);
            setAccount(null);
            setError(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await authFetch(`${API_BASE}/accounts/`, {
                headers: {
                    Accept: "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(`Falha ao carregar conta corrente (${response.status})`);
            }

            const data = (await response.json()) as ApiAccount[];
            setAccounts(data);
            const matched =
                data.find(
                    (item) =>
                        String(item.owner_type || "").toUpperCase() === "USER" &&
                        getNestedId(item.user) === String(user.id)
                ) ?? null;

            setAccount(matched);
        } catch (err) {
            setAccounts([]);
            setAccount(null);
            setError(err instanceof Error ? err.message : "Falha ao carregar conta corrente");
        } finally {
            setLoading(false);
        }
    }, [accessToken, authFetch, user?.id]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const balance = useMemo(() => parseBalance(account?.balance), [account?.balance]);
    const hasCurrentAccount = Boolean(account?.id) && Boolean(account?.is_active);
    const shopAccounts = useMemo(
        () => accounts.filter((item) => String(item.owner_type || "").toUpperCase() === "SHOP"),
        [accounts]
    );
    const getShopAccount = useCallback(
        (shopId: string | number | null | undefined) =>
            shopAccounts.find((item) => getNestedId(item.shop) === (shopId == null ? null : String(shopId))) ?? null,
        [shopAccounts]
    );

    return {
        accounts,
        account,
        balance,
        hasCurrentAccount,
        shopAccounts,
        getShopAccount,
        loading,
        error,
        refresh,
    };
}
