import { MastraBase } from '../base.js';
export declare abstract class MastraServerCache extends MastraBase {
    constructor({ name }: {
        name: string;
    });
    abstract get(key: string): Promise<unknown>;
    abstract listLength(key: string): Promise<number>;
    abstract set(key: string, value: unknown): Promise<void>;
    abstract listPush(key: string, value: unknown): Promise<void>;
    abstract listFromTo(key: string, from: number, to?: number): Promise<unknown[]>;
    abstract delete(key: string): Promise<void>;
    abstract clear(): Promise<void>;
}
//# sourceMappingURL=base.d.ts.map