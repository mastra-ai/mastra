import type { JwtReturnType } from './types';
export declare function withLegacyReturn<T extends (...args: any[]) => Promise<JwtReturnType<any, any>>>(cb: T): (...args: Parameters<T>) => Promise<NonNullable<Awaited<ReturnType<T>>["data"]>> | never;
export declare function withLegacySyncReturn<T extends (...args: any[]) => JwtReturnType<any, any>>(cb: T): (...args: Parameters<T>) => NonNullable<Awaited<ReturnType<T>>["data"]> | never;
//# sourceMappingURL=legacyReturn.d.ts.map