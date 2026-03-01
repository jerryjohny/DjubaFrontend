import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

export type Role = 'C' | 'B' | 'A';

type RoleContextValue = {
    role: Role;
    setRole: (role: Role) => void;
};

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
    const [role, setRole] = useState<Role>('C');
    const value = useMemo(() => ({ role, setRole }), [role]);

    return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
    const ctx = useContext(RoleContext);
    if (!ctx) {
        throw new Error('useRole must be used within a RoleProvider');
    }
    return ctx;
}
