/**
 * Intake source configuration: which sources feed the Factory Intake page.
 *
 * Stored per `(org, user)` in the shared application Postgres — each user
 * picks their own intake sources within the org's connected integrations:
 *  - GitHub: which of the org's projects (repos) contribute issues.
 *  - Linear: which projects contribute issues.
 *
 * `projectIds` of `null` mean "nothing selected" — the source syncs nothing
 * until the user explicitly picks projects. An `enabled` flag of `false`
 * hides the source entirely regardless of selection.
 */

import { and, eq } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { getAppDb } from '../github/db';

export interface IntakeConfig {
  github: {
    enabled: boolean;
    /** GitHub project ids (app DB uuids) to sync; `null` = nothing selected. */
    projectIds: string[] | null;
  };
  linear: {
    enabled: boolean;
    /** Linear project ids to sync; `null` = nothing selected. */
    projectIds: string[] | null;
  };
}

/** Default: both sources on, but nothing synced until projects are picked. */
export const DEFAULT_INTAKE_CONFIG: IntakeConfig = {
  github: { enabled: true, projectIds: null },
  linear: { enabled: true, projectIds: null },
};

export const intakeSettings = pgTable(
  'intake_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Owning WorkOS organization id. */
    orgId: text('org_id').notNull(),
    /** Owning WorkOS user id — intake selection is a per-user preference. */
    userId: text('user_id').notNull(),
    config: jsonb('config').$type<IntakeConfig>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [uniqueIndex('intake_settings_org_user_unique').on(table.orgId, table.userId)],
);

export const INTAKE_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS intake_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  user_id text NOT NULL,
  config jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS intake_settings_org_user_unique ON intake_settings (org_id, user_id);
`;

/** Bounded list of non-empty ids, or `null` for "nothing selected". */
function sanitizeIdList(value: unknown): string[] | null | undefined {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length > 200) return undefined;
  const ids = value.filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= 128);
  return ids.length === value.length ? ids : undefined;
}

/**
 * Validate an untrusted PUT body into an `IntakeConfig`, or `null` when the
 * shape is invalid. Unknown keys are dropped; both sections are required.
 */
export function parseIntakeConfig(body: unknown): IntakeConfig | null {
  if (typeof body !== 'object' || body === null) return null;
  const { github, linear } = body as { github?: unknown; linear?: unknown };
  if (typeof github !== 'object' || github === null) return null;
  if (typeof linear !== 'object' || linear === null) return null;

  const githubSection = github as { enabled?: unknown; projectIds?: unknown };
  const linearSection = linear as { enabled?: unknown; projectIds?: unknown };
  if (typeof githubSection.enabled !== 'boolean' || typeof linearSection.enabled !== 'boolean') return null;

  const githubProjectIds = sanitizeIdList(githubSection.projectIds ?? null);
  const linearProjectIds = sanitizeIdList(linearSection.projectIds ?? null);
  if (githubProjectIds === undefined || linearProjectIds === undefined) return null;

  return {
    github: { enabled: githubSection.enabled, projectIds: githubProjectIds },
    linear: { enabled: linearSection.enabled, projectIds: linearProjectIds },
  };
}

/** Read the caller's intake config, falling back to the defaults. */
export async function getIntakeConfig(orgId: string, userId: string): Promise<IntakeConfig> {
  const [row] = await getAppDb()
    .select()
    .from(intakeSettings)
    .where(and(eq(intakeSettings.orgId, orgId), eq(intakeSettings.userId, userId)));
  return row?.config ?? DEFAULT_INTAKE_CONFIG;
}

/** Upsert the caller's intake config. */
export async function saveIntakeConfig(orgId: string, userId: string, config: IntakeConfig): Promise<void> {
  await getAppDb()
    .insert(intakeSettings)
    .values({ orgId, userId, config })
    .onConflictDoUpdate({
      target: [intakeSettings.orgId, intakeSettings.userId],
      set: { config, updatedAt: new Date() },
    });
}
