import { setTimeout as delay } from 'node:timers/promises';
import { escapeIdentifier } from 'pg';
import type { DbClient } from '../client';
import { backoffAfterDeadlock, IndexBuildError, isDuplicateRelationError, isRetryableDeadlock } from './pg-errors';

type Relation = {
  oid: number;
  table_oid: number | null;
  table_name: string;
  table_schema: string;
  valid: boolean | null;
};

/** A cold snapshot cannot arbitrate DDL submitted by independent processes. */
export async function buildIndex(
  client: DbClient,
  schemaName: string,
  indexName: string,
  build: () => Promise<void>,
): Promise<boolean> {
  const deadline = performance.now() + 30000;
  let attempts = 0;
  let failure: unknown;
  let state = 'not built';
  let repairFailures = 0;
  const observe = (db: Pick<DbClient, 'oneOrNone'> = client) =>
    db.oneOrNone<Relation>(
      `SELECT c.oid, i.indrelid AS table_oid, t.relname AS table_name,
              tn.nspname AS table_schema, i.indisvalid AS valid
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       LEFT JOIN pg_index i ON i.indexrelid = c.oid
       LEFT JOIN pg_class t ON t.oid = i.indrelid
       LEFT JOIN pg_namespace tn ON tn.oid = t.relnamespace
      WHERE n.nspname = $1 AND c.relname = $2`,
      [schemaName, indexName],
    );

  while (true) {
    const relation = await observe();
    // DDL may legitimately outlast the retry deadline. Always confirm its result.
    if (relation?.valid) return true;
    if (relation && relation.valid === null) {
      throw new IndexBuildError(indexName, schemaName, 'name belongs to a non-index relation', failure);
    }
    if (relation) {
      const builder = await client.oneOrNone<{ pid: number }>(
        `SELECT p.pid FROM pg_stat_progress_create_index p
          WHERE p.datid = (SELECT oid FROM pg_database WHERE datname = current_database())
            AND p.pid <> pg_backend_pid()
            AND (p.index_relid = $1 OR ((p.index_relid IS NULL OR p.index_relid = 0) AND EXISTS (
              SELECT 1 FROM pg_locks l WHERE l.pid = p.pid AND l.database = p.datid
                AND l.locktype = 'relation' AND l.relation = $2 AND l.granted
                AND l.mode IN ('ShareUpdateExclusiveLock', 'ShareLock')
            )))
          LIMIT 1`,
        [relation.oid, relation.table_oid],
      );
      // Redacted progress still identifies a builder PID: corroborate its table
      // lock, rather than treating unrelated progress or ordinary maintenance as a build.
      // Defer to the table's active builder without certifying this index's validity.
      if (builder) return false;
      if (attempts >= 3 || performance.now() >= deadline) break;
      state = 'abandoned invalid index';
      // Reserve the replacement before any destructive work. A committed DROP
      // always gets its CREATE, even if the observation deadline has elapsed.
      attempts++;
      let lockUnavailable = false;
      try {
        const result = await client.tx(async tx => {
          const table = `${escapeIdentifier(relation.table_schema)}.${escapeIdentifier(relation.table_name)}`;
          await tx.none(`SET LOCAL lock_timeout = '100ms'`);
          try {
            await tx.none(`LOCK TABLE ${table} IN ACCESS EXCLUSIVE MODE`);
          } catch (error) {
            lockUnavailable = typeof error === 'object' && error !== null && 'code' in error && error.code === '55P03';
            throw error;
          }
          // Check under a transaction-scoped table lock, not just before a
          // name-based DROP. Concurrent builders/repairers cannot replace it here.
          const current = await observe(tx);
          if (current?.valid) return 'valid';
          const locked = await tx.one<{ oid: number }>('SELECT to_regclass($1)::oid AS oid', [table]);
          if (!current || current.oid !== relation.oid || current.table_oid !== locked.oid) return 'changed';
          await tx.none(`DROP INDEX ${escapeIdentifier(schemaName)}.${escapeIdentifier(indexName)}`);
          return 'dropped';
        });
        if (result === 'valid') return true;
        if (result === 'changed') {
          attempts--;
          if (performance.now() >= deadline) break;
          continue;
        }
      } catch (error) {
        attempts--;
        if (lockUnavailable) {
          state = 'table busy during invalid-index repair';
          failure ??= error;
          if (performance.now() >= deadline) break;
          await delay(100);
          continue;
        }
        if (
          !isDuplicateRelationError(error) &&
          !isRetryableDeadlock(error) &&
          !(typeof error === 'object' && error !== null && 'code' in error && error.code === '42P01')
        )
          throw error;
        failure ??= error;
        if (++repairFailures >= 3 || performance.now() >= deadline) break;
        continue;
      }
    } else {
      if (attempts >= 3 || performance.now() >= deadline) break;
      attempts++;
    }
    try {
      await build();
    } catch (error) {
      if (!isDuplicateRelationError(error) && !isRetryableDeadlock(error)) throw error;
      // Keep the first database cause while state describes the latest failure.
      failure ??= error;
      const deadlock = isRetryableDeadlock(error);
      state = deadlock ? 'index build deadlock' : 'competing index creation';
      if (deadlock && attempts < 3 && performance.now() < deadline) await backoffAfterDeadlock(attempts);
    }
  }
  throw new IndexBuildError(indexName, schemaName, state, failure);
}
