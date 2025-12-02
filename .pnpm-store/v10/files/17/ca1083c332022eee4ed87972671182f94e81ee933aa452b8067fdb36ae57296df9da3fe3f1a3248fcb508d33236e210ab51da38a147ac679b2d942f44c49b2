import type * as pgTypes from 'pg';
import type * as pgPoolTypes from 'pg-pool';
export declare type PostgresCallback = (err: Error, res: object) => unknown;
export interface PgParsedConnectionParams {
    database?: string;
    host?: string;
    port?: number;
    user?: string;
}
export interface PgClientExtended extends pgTypes.Client {
    connectionParameters: PgParsedConnectionParams;
}
export declare type PgPoolCallback = (err: Error, client: any, done: (release?: any) => void) => void;
export interface PgPoolOptionsParams {
    database: string;
    host: string;
    port: number;
    user: string;
    idleTimeoutMillis: number;
    maxClient: number;
}
export declare const EVENT_LISTENERS_SET: unique symbol;
export interface PgPoolExtended extends pgPoolTypes<pgTypes.Client> {
    options: PgPoolOptionsParams;
    [EVENT_LISTENERS_SET]?: boolean;
}
export declare type PgClientConnect = (callback?: Function) => Promise<void> | void;
//# sourceMappingURL=internal-types.d.ts.map