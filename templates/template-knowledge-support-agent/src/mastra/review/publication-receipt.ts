import { createClient, type Client, type Transaction, type TransactionMode } from '@libsql/client';
import { KnowledgeLibSQL } from '@mastra/libsql';
import type { PageMutations } from '../knowledge/versioned-page.ts';
import type { WriterContext } from '../knowledge/writer-lock.ts';

const table = 'support_review_publications';
const columns = `(
  proposal_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  reference TEXT NOT NULL,
  PRIMARY KEY (proposal_id, revision)
)`;

type Receipt = { reviewer_id: string; reference: string };
type Publication = { proposalId: string; revision: string; reviewerId: string; reference: string };
type Receipts = {
  find(): Promise<Receipt | null>;
  record(): Promise<void>;
  write(writePage: (mutations?: PageMutations) => Promise<unknown>): Promise<void>;
};

function libSQLWithReceipt(client: Client, record: (tx: Transaction) => Promise<void>): Client {
  return new Proxy(client, {
    get(target, property) {
      if (property === 'transaction')
        return async (mode?: TransactionMode) => {
          const tx = await target.transaction(mode);
          return new Proxy(tx, {
            get(transaction, property) {
              if (property === 'commit')
                return async () => {
                  await record(transaction);
                  await transaction.commit();
                };
              const value = Reflect.get(transaction, property, transaction);
              return typeof value === 'function' ? value.bind(transaction) : value;
            },
          });
        };
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/** Pair the receipt with the native leaf mutation on either database backend. */
export async function withPublicationReceipt<T>(
  { postgres, libsql }: WriterContext,
  publication: Publication,
  operation: (receipts: Receipts) => Promise<T>,
): Promise<T> {
  const key = [publication.proposalId, publication.revision];
  const values = [...key, publication.reviewerId, publication.reference];
  const fields = '(proposal_id, revision, reviewer_id, reference)';
  if (postgres) {
    const name = `public.${table}`;
    await postgres.none(`CREATE TABLE IF NOT EXISTS ${name} ${columns}`);
    const record = async () => {
      await postgres.none(`INSERT INTO ${name} ${fields} VALUES ($1, $2, $3, $4)`, values);
    };
    return operation({
      find: () =>
        postgres.oneOrNone<Receipt>(
          `SELECT reviewer_id, reference FROM ${name} WHERE proposal_id = $1 AND revision = $2`,
          key,
        ),
      record,
      async write(writePage) {
        await writePage();
        // The native mutation and this insert run on the same locked PostgreSQL transaction.
        await record();
      },
    });
  }
  const client = createClient({ url: libsql.url, authToken: libsql.authToken });
  try {
    await client.execute(`CREATE TABLE IF NOT EXISTS ${table} ${columns}`);
    const record = async (connection: Pick<Client, 'execute'> | Transaction) => {
      await connection.execute({ sql: `INSERT INTO ${table} ${fields} VALUES (?, ?, ?, ?)`, args: values });
    };
    return await operation({
      async find() {
        const { rows } = await client.execute({
          sql: `SELECT reviewer_id, reference FROM ${table} WHERE proposal_id = ? AND revision = ?`,
          args: key,
        });
        const row = rows[0];
        return row ? { reviewer_id: String(row.reviewer_id), reference: String(row.reference) } : null;
      },
      record: () => record(client),
      async write(writePage) {
        // LibSQL opens its own transaction per native mutation. Insert before its commit, so
        // the adapter rolls back both effects if the insert fails.
        const mutations = new KnowledgeLibSQL({ client: libSQLWithReceipt(client, record) });
        await writePage(mutations);
      },
    });
  } finally {
    client.close();
  }
}
