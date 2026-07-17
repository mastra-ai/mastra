/**
 * Intake source configuration domain: which sources feed the Factory Intake
 * page.
 *
 * Stored per `(org, user)` — each user picks their own intake sources within
 * the org's connected integrations:
 *  - GitHub: which of the org's projects (repos) contribute issues.
 *  - Linear: which projects contribute issues.
 *
 * `projectIds` of `null` mean "nothing selected" — the source syncs nothing
 * until the user explicitly picks projects. An `enabled` flag of `false`
 * hides the source entirely regardless of selection.
 */

import type { FactoryStorageContext, FactoryStorageDomain } from '../../domain';

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

/**
 * Abstract intake settings storage. Backends own their DDL in `init()`;
 * query methods are the typed surface the intake routes consume.
 */
export abstract class IntakeStorage implements FactoryStorageDomain {
  readonly name = 'intake';

  abstract init(ctx: FactoryStorageContext): Promise<void>;

  /** Read the caller's intake config, falling back to {@link DEFAULT_INTAKE_CONFIG}. */
  abstract getConfig(orgId: string, userId: string): Promise<IntakeConfig>;

  /** Upsert the caller's intake config. */
  abstract saveConfig(orgId: string, userId: string, config: IntakeConfig): Promise<void>;
}
