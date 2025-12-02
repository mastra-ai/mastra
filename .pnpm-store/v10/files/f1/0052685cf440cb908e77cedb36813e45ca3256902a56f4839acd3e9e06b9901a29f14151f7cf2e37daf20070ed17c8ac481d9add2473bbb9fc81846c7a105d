export type IntoSql = string | number | boolean | null | Date | ArrayBufferLike | Buffer | IntoSql[];
export declare function toSQL(value: IntoSql): string;
export declare function packBits(data: Array<number>): Array<number>;
export declare class TTLCache {
    private readonly ttl;
    private readonly cache;
    /**
     * @param ttl Time to live in milliseconds
     */
    constructor(ttl: number);
    get(key: string): any | undefined;
    set(key: string, value: any): void;
    delete(key: string): void;
}
