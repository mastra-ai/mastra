import { KyselyTypeError } from '../../util/type-error.js';
export interface MssqlDialectConfig {
    /**
     * When `true`, connections are reset to their initial states when released
     * back to the pool, resulting in additional requests to the database.
     *
     * Defaults to `false`.
     */
    resetConnectionsOnRelease?: boolean;
    /**
     * This dialect uses the `tarn` package to manage the connection pool to your
     * database. To use it as a peer dependency and not bundle it with Kysely's code,
     * you need to pass the `tarn` package itself. You also need to pass some pool options
     * (excluding `create`, `destroy` and `validate` functions which are controlled by this dialect),
     * `min` & `max` connections at the very least.
     *
     * ### Examples
     *
     * ```ts
     * import { MssqlDialect } from 'kysely'
     * import * as Tarn from 'tarn'
     * import * as Tedious from 'tedious'
     *
     * const dialect = new MssqlDialect({
     *   tarn: { ...Tarn, options: { max: 10, min: 0 } },
     *   tedious: {
     *     ...Tedious,
     *     connectionFactory: () => new Tedious.Connection({
     *       // ...
     *       server: 'localhost',
     *       // ...
     *     }),
     *   }
     * })
     * ```
     */
    tarn: Tarn;
    /**
     * This dialect uses the `tedious` package to communicate with your MS SQL Server
     * database. To use it as a peer dependency and not bundle it with Kysely's code,
     * you need to pass the `tedious` package itself. You also need to pass a factory
     * function that creates new `tedious` `Connection` instances on demand.
     *
     * ### Examples
     *
     * ```ts
     * import { MssqlDialect } from 'kysely'
     * import * as Tarn from 'tarn'
     * import * as Tedious from 'tedious'
     *
     * const dialect = new MssqlDialect({
     *   tarn: { ...Tarn, options: { max: 10, min: 0 } },
     *   tedious: {
     *     ...Tedious,
     *     connectionFactory: () => new Tedious.Connection({
     *       // ...
     *       server: 'localhost',
     *       // ...
     *     }),
     *   }
     * })
     * ```
     */
    tedious: Tedious;
    /**
     * When `true`, connections are validated before being acquired from the pool,
     * resulting in additional requests to the database.
     *
     * Defaults to `true`.
     */
    validateConnections?: boolean;
}
export interface Tedious {
    connectionFactory: () => TediousConnection | Promise<TediousConnection>;
    ISOLATION_LEVEL: TediousIsolationLevel;
    Request: TediousRequestClass;
    /**
     * @deprecated use {@link MssqlDialectConfig.resetConnectionsOnRelease} instead.
     */
    resetConnectionOnRelease?: KyselyTypeError<'deprecated: use `MssqlDialectConfig.resetConnectionsOnRelease` instead'>;
    TYPES: TediousTypes;
}
export interface TediousConnection {
    beginTransaction(callback: (err: Error | null | undefined, transactionDescriptor?: any) => void, name?: string | undefined, isolationLevel?: number | undefined): void;
    cancel(): boolean;
    close(): void;
    commitTransaction(callback: (err: Error | null | undefined) => void, name?: string | undefined): void;
    connect(connectListener: (err?: Error) => void): void;
    execSql(request: TediousRequest): void;
    off(event: 'error', listener: (error: unknown) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
    on(event: 'error', listener: (error: unknown) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
    once(event: 'end', listener: () => void): this;
    once(event: string, listener: (...args: any[]) => void): this;
    reset(callback: (err: Error | null | undefined) => void): void;
    rollbackTransaction(callback: (err: Error | null | undefined) => void, name?: string | undefined): void;
    saveTransaction(callback: (err: Error | null | undefined) => void, name: string): void;
}
export type TediousIsolationLevel = Record<string, number>;
export interface TediousRequestClass {
    new (sqlTextOrProcedure: string | undefined, callback: (error?: Error | null, rowCount?: number, rows?: any) => void, options?: {
        statementColumnEncryptionSetting?: any;
    }): TediousRequest;
}
export declare class TediousRequest {
    addParameter(name: string, dataType: TediousDataType, value?: unknown, options?: Readonly<{
        output?: boolean;
        length?: number;
        precision?: number;
        scale?: number;
    }> | null): void;
    off(event: 'row', listener: (columns: any) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
    on(event: 'row', listener: (columns: any) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
    once(event: 'requestCompleted', listener: () => void): this;
    once(event: string, listener: (...args: any[]) => void): this;
    pause(): void;
    resume(): void;
}
export interface TediousTypes {
    NVarChar: TediousDataType;
    BigInt: TediousDataType;
    Int: TediousDataType;
    Float: TediousDataType;
    Bit: TediousDataType;
    DateTime: TediousDataType;
    VarBinary: TediousDataType;
    [x: string]: TediousDataType;
}
export interface TediousDataType {
}
export interface TediousColumnValue {
    metadata: {
        colName: string;
    };
    value: any;
}
export interface Tarn {
    /**
     * Tarn.js' pool options, excluding `create`, `destroy` and `validate` functions,
     * which must be implemented by this dialect.
     */
    options: Omit<TarnPoolOptions<any>, 'create' | 'destroy' | 'validate'> & {
        /**
         * @deprecated use {@link MssqlDialectConfig.validateConnections} instead.
         */
        validateConnections?: KyselyTypeError<'deprecated: use `MssqlDialectConfig.validateConnections` instead'>;
    };
    /**
     * Tarn.js' Pool class.
     */
    Pool: typeof TarnPool;
}
export declare class TarnPool<R> {
    constructor(opt: TarnPoolOptions<R>);
    acquire(): TarnPendingRequest<R>;
    destroy(): any;
    release(resource: R): void;
}
export interface TarnPoolOptions<R> {
    acquireTimeoutMillis?: number;
    create(cb: (err: Error | null, resource: R) => void): any | (() => Promise<R>);
    createRetryIntervalMillis?: number;
    createTimeoutMillis?: number;
    destroy(resource: R): any;
    destroyTimeoutMillis?: number;
    idleTimeoutMillis?: number;
    log?(msg: string): any;
    max: number;
    min: number;
    propagateCreateError?: boolean;
    reapIntervalMillis?: number;
    validate?(resource: R): boolean;
}
export interface TarnPendingRequest<R> {
    promise: Promise<R>;
    resolve: (resource: R) => void;
    reject: (err: Error) => void;
}
