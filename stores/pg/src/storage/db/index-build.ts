import { escapeIdentifier } from 'pg';
import type { DbClient } from '../client';
import { backoffAfterDeadlock, IndexBuildError, isDuplicateRelationError, isRetryableDeadlock } from './pg-errors';

type Relation = { oid: number; table_oid: number | null; valid: boolean | null };
type Progress = { pid: number; datid: number | null; relid: number | null; index_relid: number | null };

/** A cold snapshot cannot arbitrate DDL submitted by independent processes. */
export async function buildIndex(
  client: DbClient,
  schemaName: string,
  indexName: string,
  build: () => Promise<void>,
): Promise<void> {
  const deadline = Date.now() + 30000;
  let attempts = 0;
  let failure: unknown;
  let state = 'not built';
  let mustConfirm = false;
  let repairFailures = 0;

  while (true) {
    const relation = await client.oneOrNone<Relation>(
      `SELECT c.oid, i.indrelid AS table_oid, i.indisvalid AS valid
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         LEFT JOIN pg_index i ON i.indexrelid = c.oid
        WHERE n.nspname = $1 AND c.relname = $2`,
      [schemaName, indexName],
    );
    if (relation?.valid) return;
    if (relation && relation.valid === null) {
      throw new IndexBuildError(indexName, schemaName, 'name belongs to a non-index relation', failure);
    }
    // Always confirm a completed build, even if its DDL exceeded the observation deadline.
    if (Date.now() >= deadline) break;
    if (relation) {
      const visibility = await client.one<{ database_oid: number; version: number; full_stats: boolean }>(
        `SELECT oid AS database_oid, current_setting('server_version_num')::int AS version,
                (SELECT rolsuper FROM pg_roles WHERE rolname = current_user)
                  OR pg_has_role(current_user, 'pg_read_all_stats', 'USAGE') AS full_stats
           FROM pg_database WHERE datname = current_database()`,
      );
      // Do not filter NULL target fields away: another role's progress is redacted.
      const progress = await client.any<Progress>(
        'SELECT pid, datid, relid, index_relid FROM pg_stat_progress_create_index',
      );
      const possibleBuilders = progress.filter(
        row =>
          (row.datid === null || row.datid === visibility.database_oid) &&
          (row.relid === null || row.relid === relation.table_oid) &&
          (row.index_relid === null || row.index_relid === 0 || row.index_relid === relation.oid),
      );
      // PG 12–18 retain redacted progress rows; unknown future versions require full visibility.
      const knownVisibility = visibility.full_stats || (visibility.version >= 120000 && visibility.version < 190000);
      if (possibleBuilders.length > 0 || !knownVisibility) {
        state = `waiting for index validity; possible builders: ${possibleBuilders.map(row => row.pid).join(', ') || 'unknown visibility'}`;
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      // Exhausted creators can still observe another builder, but must not drop its artifact.
      if (attempts >= 3) break;
      state = 'abandoned invalid index';
      try {
        await client.none(
          `DROP INDEX CONCURRENTLY IF EXISTS ${escapeIdentifier(schemaName)}.${escapeIdentifier(indexName)}`,
        );
      } catch (error) {
        if (
          !isDuplicateRelationError(error) &&
          !isRetryableDeadlock(error) &&
          !(typeof error === 'object' && error !== null && 'code' in error && error.code === '42704')
        )
          throw error;
        failure ??= error;
        if (++repairFailures >= 3) break;
        // A repairer may have replaced the object while DROP waited. Re-observe it live.
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
    } else {
      if (attempts >= 3) break;
      if (mustConfirm) state = 'index disappeared before validity could be confirmed';
    }
    // A completed destructive repair must get its replacement build even when
    // DROP INDEX itself waited past the observation deadline.
    attempts++;
    try {
      await build();
      // IF NOT EXISTS can succeed against an invalid concurrent artifact.
      mustConfirm = true;
    } catch (error) {
      if (!isDuplicateRelationError(error) && !isRetryableDeadlock(error)) throw error;
      failure ??= error;
      const deadlock = isRetryableDeadlock(error);
      state = deadlock ? 'index build deadlock' : 'competing index creation';
      if (deadlock && attempts < 3 && Date.now() < deadline) await backoffAfterDeadlock(attempts);
    }
  }
  throw new IndexBuildError(indexName, schemaName, state, failure);
}
