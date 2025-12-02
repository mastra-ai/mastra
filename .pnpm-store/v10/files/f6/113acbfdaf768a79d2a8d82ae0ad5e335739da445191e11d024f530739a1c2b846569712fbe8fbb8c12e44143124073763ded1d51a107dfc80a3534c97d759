import type { Disposer } from '../types';
declare const Temp: {
    store: Record<string, boolean>;
    create: (filePath: string) => string;
    get: (filePath: string, creator: (filePath: string) => string, purge?: boolean) => [string, Disposer];
    purge: (filePath: string) => void;
    purgeSync: (filePath: string) => void;
    purgeSyncAll: () => void;
    truncate: (filePath: string) => string;
};
export default Temp;
