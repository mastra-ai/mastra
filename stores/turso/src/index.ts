import type { RetentionConfig } from '@mastra/core/storage';
import type { SqliteClient } from '@mastra/libsql';
import { LibSQLStore } from '@mastra/libsql';

import { TursoSqliteClient } from './client';
import type { TursoClientConfig, TursoExperimentalFeature } from './client';
import { getTursoDatabaseSupport } from './support';

export type { TursoExperimentalFeature } from './client';
export type { TursoDatabaseSupport, TursoDatabaseSupportOptions, TursoLinuxLibc } from './support';
export { getTursoDatabaseSupport } from './support';

export interface TursoStoreBaseConfig {
  id: string;
  maxRetries?: number;
  initialBackoffMs?: number;
  disableInit?: boolean;
  retention?: RetentionConfig;
}

export type TursoStoreConfig = TursoStoreBaseConfig &
  (
    | {
        path: string;
        client?: never;
        readonly?: boolean;
        fileMustExist?: boolean;
        timeout?: number;
        defaultQueryTimeout?: number;
        tracing?: 'info' | 'debug' | 'trace';
        experimental?: TursoExperimentalFeature[];
      }
    | {
        client: SqliteClient;
        path?: never;
      }
  );

export class TursoStore extends LibSQLStore {
  #closePromise?: Promise<void>;

  constructor(config: TursoStoreConfig) {
    if (!config.id || typeof config.id !== 'string' || config.id.trim() === '') {
      throw new Error('TursoStore: id must be provided and cannot be empty.');
    }

    let client: SqliteClient;
    if ('client' in config && config.client) {
      client = config.client;
    } else {
      if (!config.path || typeof config.path !== 'string' || config.path.trim() === '') {
        throw new Error('TursoStore: path must be provided and cannot be empty.');
      }
      const support = getTursoDatabaseSupport();
      if (!support.supported) {
        throw new Error(support.reason ?? `Turso Database is not supported on ${support.platform}/${support.arch}.`);
      }
      const clientConfig: TursoClientConfig = {
        path: config.path,
        ...(config.readonly === undefined ? {} : { readonly: config.readonly }),
        ...(config.fileMustExist === undefined ? {} : { fileMustExist: config.fileMustExist }),
        ...(config.timeout === undefined ? {} : { timeout: config.timeout }),
        ...(config.defaultQueryTimeout === undefined ? {} : { defaultQueryTimeout: config.defaultQueryTimeout }),
        ...(config.tracing === undefined ? {} : { tracing: config.tracing }),
        ...(config.experimental === undefined ? {} : { experimental: config.experimental }),
      };
      client = new TursoSqliteClient(clientConfig);
    }

    super({
      id: config.id,
      client,
      ...(config.maxRetries === undefined ? {} : { maxRetries: config.maxRetries }),
      ...(config.initialBackoffMs === undefined ? {} : { initialBackoffMs: config.initialBackoffMs }),
      ...(config.disableInit === undefined ? {} : { disableInit: config.disableInit }),
      ...(config.retention === undefined ? {} : { retention: config.retention }),
    });
    this.name = 'TursoStore';
  }

  override close(): Promise<void> {
    this.#closePromise ??= super.close();
    return this.#closePromise;
  }
}
