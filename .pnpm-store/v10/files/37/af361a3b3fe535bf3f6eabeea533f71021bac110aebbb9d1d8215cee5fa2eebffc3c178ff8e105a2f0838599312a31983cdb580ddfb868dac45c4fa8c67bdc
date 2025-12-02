import type { ClientConnectionHolder } from "./baseClient";
import type { BaseRawConnection } from "./baseConn";
import { type Executor, type QueryArgs, type SQLQueryArgs } from "./ifaces";
import type { Options } from "./options";
export declare enum TransactionState {
    ACTIVE = 0,
    COMMITTED = 1,
    ROLLEDBACK = 2,
    FAILED = 3
}
export declare class TransactionImpl {
    protected _holder: ClientConnectionHolder;
    private _rawConn;
    private _state;
    private _opInProgress;
    private constructor();
    _runOp<T>(opname: string, op: () => Promise<T>, errMessage?: string): Promise<T>;
    _runFetchOp(opName: string, ...args: Parameters<BaseRawConnection["fetch"]>): Promise<any>;
}
export declare class Transaction implements Executor {
    private impl;
    private options;
    constructor(impl: TransactionImpl, options: Options);
    withSQLRowMode(mode: "array" | "object"): Transaction;
    execute(query: string, args?: QueryArgs): Promise<void>;
    executeSQL(query: string, args?: SQLQueryArgs): Promise<void>;
    query<T = unknown>(query: string, args?: QueryArgs): Promise<T[]>;
    querySQL<T = unknown>(query: string, args?: SQLQueryArgs): Promise<T[]>;
    queryJSON(query: string, args?: QueryArgs): Promise<string>;
    querySingle<T = unknown>(query: string, args?: QueryArgs): Promise<T | null>;
    querySingleJSON(query: string, args?: QueryArgs): Promise<string>;
    queryRequired<T = unknown>(query: string, args?: QueryArgs): Promise<[T, ...T[]]>;
    queryRequiredJSON(query: string, args?: QueryArgs): Promise<string>;
    queryRequiredSingle<T = unknown>(query: string, args?: QueryArgs): Promise<T>;
    queryRequiredSingleJSON(query: string, args?: QueryArgs): Promise<string>;
}
