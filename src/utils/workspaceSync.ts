const WORKSPACE_SYNC_EVENT = "djuba:workspace-sync";
const WORKSPACE_SYNC_STORAGE_KEY = "djuba:workspace-sync";

export type WorkspaceSyncPayload = {
    timestamp: number;
    shopId?: string | null;
    queueId?: string | null;
    serviceId?: string | null;
    source?: string;
};

export function emitWorkspaceSync(payload: Omit<WorkspaceSyncPayload, "timestamp">) {
    if (typeof window === "undefined") return;

    const detail: WorkspaceSyncPayload = {
        ...payload,
        timestamp: Date.now(),
    };

    window.dispatchEvent(new CustomEvent<WorkspaceSyncPayload>(WORKSPACE_SYNC_EVENT, { detail }));

    try {
        window.localStorage.setItem(WORKSPACE_SYNC_STORAGE_KEY, JSON.stringify(detail));
    } catch {
        // Ignore storage failures in private/restricted contexts.
    }
}

export function subscribeWorkspaceSync(callback: (payload: WorkspaceSyncPayload) => void) {
    if (typeof window === "undefined") {
        return () => undefined;
    }

    const handleCustomEvent = (event: Event) => {
        const customEvent = event as CustomEvent<WorkspaceSyncPayload>;
        if (customEvent.detail) {
            callback(customEvent.detail);
        }
    };

    const handleStorage = (event: StorageEvent) => {
        if (event.key !== WORKSPACE_SYNC_STORAGE_KEY || !event.newValue) return;

        try {
            callback(JSON.parse(event.newValue) as WorkspaceSyncPayload);
        } catch {
            // Ignore malformed storage payloads.
        }
    };

    window.addEventListener(WORKSPACE_SYNC_EVENT, handleCustomEvent as EventListener);
    window.addEventListener("storage", handleStorage);

    return () => {
        window.removeEventListener(WORKSPACE_SYNC_EVENT, handleCustomEvent as EventListener);
        window.removeEventListener("storage", handleStorage);
    };
}
