import { createClient } from '@libsql/client';
import type { KnowledgeStorage } from '@mastra/core/knowledge';
import { KnowledgeLibSQL, type LibSQLStore } from '@mastra/libsql';
import { KnowledgePG, PostgresStore, type DbClient } from '@mastra/pg';
import { historyStorage, libsqlQuery, postgresQuery } from './history-storage.ts';
import type { StoreConfiguration } from './store.ts';

type SnapshotStore = Pick<KnowledgeStorage, 'listNotes' | 'getNote'> &
  Pick<ReturnType<typeof historyStorage>, 'locations'>;
export type KnowledgeReadSnapshot = <T>(read: (store: SnapshotStore) => Promise<T>) => Promise<T>;

export function createKnowledgeReadSnapshot(
  store: LibSQLStore | PostgresStore,
  configuration: StoreConfiguration,
): KnowledgeReadSnapshot {
  const unsupported = () => {
    throw new Error('Knowledge read snapshot only supports reads on its transaction');
  };
  if (configuration.backend === 'postgres') {
    if (!(store instanceof PostgresStore)) throw new Error('Expected the PostgreSQL Knowledge store');
    return read =>
      store.db.tx(async tx => {
        await tx.none('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
        const client: DbClient = {
          get $pool(): never {
            return unsupported();
          },
          connect: unsupported,
          tx: unsupported,
          query: tx.query.bind(tx),
          none: tx.none.bind(tx),
          one: tx.one.bind(tx),
          oneOrNone: tx.oneOrNone.bind(tx),
          any: tx.any.bind(tx),
          many: tx.many.bind(tx),
          manyOrNone: tx.manyOrNone.bind(tx),
        };
        const knowledge = new KnowledgePG({ client, schemaName: 'public', storageIsolationKey: tx });
        return read({
          listNotes: knowledge.listNotes.bind(knowledge),
          getNote: knowledge.getNote.bind(knowledge),
          locations: historyStorage(postgresQuery(tx), 'postgres').locations,
        });
      });
  }
  return async read => {
    const client = createClient({ url: configuration.url, authToken: configuration.authToken });
    try {
      const tx = await client.transaction('read');
      try {
        const knowledge = new KnowledgeLibSQL({
          client: {
            protocol: client.protocol,
            get closed() {
              return tx.closed;
            },
            execute: tx.execute.bind(tx),
            batch: unsupported,
            transaction: unsupported,
            close: unsupported,
          },
        });
        return await read({
          listNotes: knowledge.listNotes.bind(knowledge),
          getNote: knowledge.getNote.bind(knowledge),
          locations: historyStorage(libsqlQuery(tx), 'libsql').locations,
        });
      } finally {
        tx.close();
      }
    } finally {
      client.close();
    }
  };
}
