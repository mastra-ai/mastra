import { createHash } from 'node:crypto';
import { Pool } from 'pg';

export interface AdmissionLimits {
  enabled: boolean;
  windowMs: number;
  ownerSubmissions: number;
  globalSubmissions: number;
  ownerActive: number;
  globalActive: number;
}
export const defaultAdmissionLimits: AdmissionLimits = {
  enabled: true,
  windowMs: 3_600_000,
  ownerSubmissions: 5,
  globalSubmissions: 20,
  ownerActive: 2,
  globalActive: 8,
};
export class AdmissionError extends Error {
  constructor(
    readonly status: 429 | 503 | 409,
    message: string,
    readonly retryAfter = 5,
  ) {
    super(message);
  }
}
export interface Admission {
  reserve(runId: string, owner: string, input: unknown): Promise<boolean>;
  close(): Promise<void>;
}

/** Application policy only. Does not replace Render scheduling or Mastra run state. */
export function createAdmission(options: {
  connectionString: string;
  namespace: string;
  limits?: Partial<AdmissionLimits>;
  getStatus(runId: string): Promise<string | null>;
}): Admission {
  const limits = { ...defaultAdmissionLimits, ...options.limits };
  for (const [key, value] of Object.entries(limits)) {
    if (key !== 'enabled' && (!Number.isSafeInteger(value) || Number(value) < 1))
      throw new Error(`Admission limit ${key} must be a positive integer`);
  }
  if (typeof limits.enabled !== 'boolean' || !options.namespace) throw new Error('Invalid admission configuration');
  const pool = new Pool({
    connectionString: options.connectionString,
    max: 3,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
  });
  let ready: Promise<unknown> | undefined;
  const initialize = () =>
    (ready ??= (async () => {
      const connection = await pool.connect();
      try {
        await connection.query('BEGIN');
        await connection.query("SELECT pg_advisory_xact_lock(hashtextextended('mastra-admission-schema', 0))");
        await connection.query(`
    CREATE TABLE IF NOT EXISTS mastra_render_admissions (
      namespace text NOT NULL, run_id text NOT NULL, owner text NOT NULL, input_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), settled_at timestamptz,
      PRIMARY KEY(namespace, run_id)
    );
    CREATE INDEX IF NOT EXISTS mastra_render_admissions_active
      ON mastra_render_admissions(namespace) WHERE settled_at IS NULL;
    CREATE INDEX IF NOT EXISTS mastra_render_admissions_window ON mastra_render_admissions(namespace, created_at);
  `);
        await connection.query('COMMIT');
      } catch (error) {
        await connection.query('ROLLBACK');
        throw error;
      } finally {
        connection.release();
      }
    })().catch(error => {
      ready = undefined;
      throw error;
    }));
  return {
    async reserve(runId, owner, input) {
      if (!runId || !owner) throw new Error('Admission requires a run and owner');
      const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
      await initialize();
      // Reconcile outside the admission transaction. Unknown/absent runs keep their reservation.
      const active = await pool.query<{ run_id: string }>(
        'SELECT run_id FROM mastra_render_admissions WHERE namespace=$1 AND settled_at IS NULL',
        [options.namespace],
      );
      for (const row of active.rows) {
        const status = await options.getStatus(row.run_id);
        if (status && ['success', 'failed', 'canceled'].includes(status))
          await pool.query(
            'UPDATE mastra_render_admissions SET settled_at=now() WHERE namespace=$1 AND run_id=$2 AND settled_at IS NULL',
            [options.namespace, row.run_id],
          );
      }
      const connection = await pool.connect();
      try {
        await connection.query('BEGIN');
        await connection.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
          `mastra-admission:${options.namespace}`,
        ]);
        const existing = await connection.query<{ owner: string; input_hash: string }>(
          'SELECT owner,input_hash FROM mastra_render_admissions WHERE namespace=$1 AND run_id=$2',
          [options.namespace, runId],
        );
        if (existing.rows[0]) {
          if (existing.rows[0].owner !== owner || existing.rows[0].input_hash !== hash)
            throw new AdmissionError(409, 'This run ID is already reserved for another submission.');
          await connection.query('COMMIT');
          return false;
        }
        if (!limits.enabled)
          throw new AdmissionError(503, 'New submissions are temporarily paused. Existing jobs remain available.');
        const result = await connection.query<{
          global_rate: string;
          owner_rate: string;
          global_active: string;
          owner_active: string;
        }>(
          `
          SELECT count(*) FILTER (WHERE created_at > now()-($3::bigint * interval '1 millisecond')) AS global_rate,
            count(*) FILTER (WHERE owner=$2 AND created_at > now()-($3::bigint * interval '1 millisecond')) AS owner_rate,
            count(*) FILTER (WHERE settled_at IS NULL) AS global_active,
            count(*) FILTER (WHERE owner=$2 AND settled_at IS NULL) AS owner_active
          FROM mastra_render_admissions WHERE namespace=$1`,
          [options.namespace, owner, limits.windowMs],
        );
        const counts = result.rows[0]!;
        if (
          Number(counts.global_rate) >= limits.globalSubmissions ||
          Number(counts.owner_rate) >= limits.ownerSubmissions
        )
          throw new AdmissionError(
            429,
            'Review submission limit reached. Try again later.',
            Math.ceil(limits.windowMs / 1000),
          );
        if (Number(counts.global_active) >= limits.globalActive || Number(counts.owner_active) >= limits.ownerActive)
          throw new AdmissionError(429, 'Too many active reviews. Wait for an existing review to finish.');
        await connection.query(
          'INSERT INTO mastra_render_admissions(namespace,run_id,owner,input_hash) VALUES($1,$2,$3,$4)',
          [options.namespace, runId, owner, hash],
        );
        await connection.query('COMMIT');
        return true;
      } catch (error) {
        await connection.query('ROLLBACK');
        throw error;
      } finally {
        connection.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}

/** Shared environment convention for the example and its standalone consumer. */
export function admissionLimitsFromEnv(env: NodeJS.ProcessEnv): Partial<AdmissionLimits> {
  const result: Partial<AdmissionLimits> = {};
  if (env.SUBMISSIONS_ENABLED !== undefined) {
    if (!['true', 'false'].includes(env.SUBMISSIONS_ENABLED))
      throw new Error('SUBMISSIONS_ENABLED must be true or false');
    result.enabled = env.SUBMISSIONS_ENABLED === 'true';
  }
  for (const [key, name] of Object.entries({
    windowMs: 'SUBMISSION_WINDOW_MS',
    ownerSubmissions: 'SUBMISSIONS_PER_OWNER',
    globalSubmissions: 'SUBMISSIONS_GLOBAL',
    ownerActive: 'ACTIVE_RUNS_PER_OWNER',
    globalActive: 'ACTIVE_RUNS_GLOBAL',
  })) {
    if (env[name] !== undefined) Object.assign(result, { [key]: Number(env[name]) });
  }
  return result;
}
