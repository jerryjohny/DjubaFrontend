export type ShopStatusType = 'open' | 'closingSoon' | 'closed';

export type QueueStatus = 'open' | 'paused' | 'closed' | 'closingSoon' | 'inactive';

export type BarberInfo = {
    id: string;
    name: string;
    specialty: string;
    status: 'atendimento' | 'pausa' | 'offline';
};

export type QueueClientInfo = {
    id: string;
    name: string;
    phone: string;
    avatar: string;
    serviceId?: string | null;
    serviceStatus?: string | null;
    serviceName?: string | null;
    serviceAverageTime?: string | null;
    position?: number | null;
    joinedQueueAt?: string | null;
    startTime?: string | null;
    finishTime?: string | null;
};

export type QueueInfo = {
    id: string;
    name: string;
    date: string | null;
    status: QueueStatus;
    assignedBarberId: string | null;
    waitEstimate: string;
    capacity: number;
    customers: number;
    barbers: BarberInfo[];
    clients?: QueueClientInfo[];
    currentUserServiceId?: string | null;
    currentUserPosition?: number | null;
    currentUserServiceName?: string | null;
};

export type ShopInfo = {
    id: string;
    name: string;
    distanceKm: number;
    rating?: number;
    image: string;
    hasCurrentAccount: boolean;
    status: {
        type: ShopStatusType;
        time: string;
    };
    description?: string;
    location?: string;
    queues: QueueInfo[];
};

export const SHOPS: ShopInfo[] = [
    {
        id: 's1',
        name: 'Docinho Cortes',
        distanceKm: 0.4,
        rating: 4.7,
        image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=900&q=60',
        hasCurrentAccount: true,
        status: { type: 'open', time: '21h00' },
        description: 'Classicos e cortes modernos com atendimento premium.',
        location: 'R. Mário Coluna, 45 - Maputo',
        queues: [
            {
                id: 'q1',
                name: 'Cortes classicos',
                date: null,
                assignedBarberId: null,
                status: 'open',
                waitEstimate: '~25 min',
                capacity: 10,
                customers: 6,
                barbers: [
                    { id: 'b1', name: 'Docinho', specialty: 'Fade e tesoura', status: 'atendimento' },
                    { id: 'b2', name: 'Marcia', specialty: 'Design de barba', status: 'pausa' },
                ],
            },
            {
                id: 'q2',
                name: 'Barbas e tratamentos',
                date: null,
                assignedBarberId: null,
                status: 'closingSoon',
                waitEstimate: '~15 min',
                capacity: 8,
                customers: 10,
                barbers: [
                    { id: 'b3', name: 'Ivo', specialty: 'Navalha quente', status: 'atendimento' },
                ],
            },
        ],
    },
    {
        id: 's2',
        name: 'Corte Fino',
        distanceKm: 1.2,
        rating: 4.5,
        image: 'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=900&q=60',
        hasCurrentAccount: true,
        status: { type: 'closingSoon', time: '17h30' },
        description: 'Referencia em cortes rapidos para quem esta com pressa.',
        location: 'Rua da Liberdade, 12 - Maputo',
        queues: [
            {
                id: 'q3',
                name: 'Express',
                date: null,
                assignedBarberId: null,
                status: 'open',
                waitEstimate: '~10 min',
                capacity: 12,
                customers: 5,
                barbers: [
                    { id: 'b4', name: 'Claudio', specialty: 'Maquina', status: 'atendimento' },
                    { id: 'b5', name: 'Sara', specialty: 'Infantil', status: 'offline' },
                ],
            },
        ],
    },
    {
        id: 's3',
        name: 'Bigode Dourado',
        distanceKm: 2.1,
        rating: 4.8,
        image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=60',
        hasCurrentAccount: true,
        status: { type: 'closed', time: '09h00' },
        description: 'Experiencia artesanal focada em barbas e grooming.',
        location: 'Av. 25 de Setembro, 300 - Maputo',
        queues: [
            {
                id: 'q4',
                name: 'Barbas Premium',
                date: null,
                assignedBarberId: null,
                status: 'closed',
                waitEstimate: 'Abre amanha',
                capacity: 6,
                customers: 0,
                barbers: [
                    { id: 'b6', name: 'Zito', specialty: 'Modelacao', status: 'offline' },
                ],
            },
        ],
    },
];
