export type AccountState = {
    balance: number;
    hasCurrentAccount: boolean;
};

const STORAGE_KEY = 'djuba-accounts';
const DEFAULT_ACCOUNT: AccountState = {
    balance: 650,
    hasCurrentAccount: true,
};

type StoredAccounts = Record<string, AccountState>;

function readStore(): StoredAccounts {
    if (typeof window === 'undefined') return {};

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as StoredAccounts) : {};
    } catch {
        return {};
    }
}

function writeStore(next: StoredAccounts) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function getAccountState(userId?: number | null): AccountState {
    if (!userId) return DEFAULT_ACCOUNT;
    const stored = readStore()[String(userId)];
    return stored ? { ...DEFAULT_ACCOUNT, ...stored } : DEFAULT_ACCOUNT;
}

export function setAccountState(userId: number, next: AccountState) {
    const store = readStore();
    store[String(userId)] = next;
    writeStore(store);
}

export function updateAccountState(userId: number, patch: Partial<AccountState>) {
    const current = getAccountState(userId);
    const next = { ...current, ...patch };
    setAccountState(userId, next);
    return next;
}
