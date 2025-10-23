import type { Client } from "@libsql/client";

export type LibSQLConfig =
    | {
        url: string;
        authToken?: string;
        /**
         * Maximum number of retries for write operations if an SQLITE_BUSY error occurs.
         * @default 5
         */
        maxRetries?: number;
        /**
         * Initial backoff time in milliseconds for retrying write operations on SQLITE_BUSY.
         * The backoff time will double with each retry (exponential backoff).
         * @default 100
         */
        initialBackoffMs?: number;
    }
    | {
        client: Client;
        maxRetries?: number;
        initialBackoffMs?: number;
    };