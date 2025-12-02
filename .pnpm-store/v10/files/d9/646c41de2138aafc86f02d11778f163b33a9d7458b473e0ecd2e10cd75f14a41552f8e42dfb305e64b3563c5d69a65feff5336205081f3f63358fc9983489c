import { DatabaseConnection } from '../../driver/database-connection.js';
/**
 * Config for the MySQL dialect.
 *
 * https://github.com/sidorares/node-mysql2#using-connection-pools
 */
export interface MysqlDialectConfig {
    /**
     * A mysql2 Pool instance or a function that returns one.
     *
     * If a function is provided, it's called once when the first query is executed.
     *
     * https://github.com/sidorares/node-mysql2#using-connection-pools
     */
    pool: MysqlPool | (() => Promise<MysqlPool>);
    /**
     * Called once for each created connection.
     */
    onCreateConnection?: (connection: DatabaseConnection) => Promise<void>;
    /**
     * Called every time a connection is acquired from the connection pool.
     */
    onReserveConnection?: (connection: DatabaseConnection) => Promise<void>;
}
/**
 * This interface is the subset of mysql2 driver's `Pool` class that
 * kysely needs.
 *
 * We don't use the type from `mysql2` here to not have a dependency to it.
 *
 * https://github.com/sidorares/node-mysql2#using-connection-pools
 */
export interface MysqlPool {
    getConnection(callback: (error: unknown, connection: MysqlPoolConnection) => void): void;
    end(callback: (error: unknown) => void): void;
}
export interface MysqlPoolConnection {
    query(sql: string, parameters: ReadonlyArray<unknown>): {
        stream: <T>(options: MysqlStreamOptions) => MysqlStream<T>;
    };
    query(sql: string, parameters: ReadonlyArray<unknown>, callback: (error: unknown, result: MysqlQueryResult) => void): void;
    release(): void;
}
export interface MysqlStreamOptions {
    highWaterMark?: number;
    objectMode?: true;
}
export interface MysqlStream<T> {
    [Symbol.asyncIterator](): AsyncIterableIterator<T>;
}
export interface MysqlOkPacket {
    affectedRows: number;
    changedRows: number;
    insertId: number;
}
export type MysqlQueryResult = MysqlOkPacket | Record<string, unknown>[];
