/**
 * The environment and sandbox-env contracts, apart from the rest of the route
 * contracts so a host can validate the same bodies without loading boards,
 * rules or work items. Imports nothing but zod.
 */
import { z } from 'zod';

export const UUID_PATTERN = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
export const uuidSchema = z.string().regex(new RegExp(UUID_PATTERN));
export const nullableTrimmed = (max: number) =>
  z.union([
    z
      .string()
      .trim()
      .max(max)
      .transform(value => value || null),
    z.null(),
  ]);

export const environmentRepositorySchema = z.object({
  projectRepositoryId: z.string(),
  connectionId: z.string(),
  repositoryId: z.string(),
  // Null when the repository row behind the link is missing.
  slug: z.string().nullable(),
  defaultBranch: z.string().nullable(),
  position: z.number().int(),
  inEnvironment: z.boolean(),
  setupCommand: z.string().nullable(),
  teardownCommand: z.string().nullable(),
  lastBuildStatus: z.enum(['unbuilt', 'configured', 'failed']),
  lastBuildError: z.string().nullable(),
});

/** The configured FactorySandbox as factory describes it: provider id, JSON Schema of its settings, capabilities. */
export const environmentSandboxSchema = z.object({
  provider: z.string(),
  settingsSchema: z.record(z.string(), z.unknown()),
  capabilities: z.object({
    template: z.boolean(),
    builds: z.object({ available: z.boolean(), history: z.boolean() }),
  }),
});

/** When the environment builds on its own; present only when the sandbox can build. */
export const environmentBuildTriggersSchema = z.object({
  schedule: z.object({
    enabled: z.boolean(),
    cron: z.string().nullable(),
    timezone: z.string().nullable(),
    /** False when the host's storage has no schedules domain; the cron trigger cannot be enabled then. */
    scheduleAvailable: z.boolean(),
  }),
  push: z.object({ enabled: z.boolean(), debounceMinutes: z.number().int() }),
});

/** The last build factory asked the provider for, from the project row only; status is read live. */
export const environmentLastBuildSchema = z.object({ buildId: z.string(), attemptedAt: z.string().nullable() });

/**
 * Names Factory or a sandbox provider injects into the same environment maps.
 * A variable with one of these names would swap a credential or be dropped.
 */
export const RESERVED_SANDBOX_ENV_NAMES: readonly RegExp[] = [
  /^GH_TOKEN(_\d+)?$/,
  /^MASTRA_REPOSITORY_ACCESS_TOKEN(_\d+)?$/,
  /^MASTRA_BUILD_ENV_REVISION$/,
];
export const MAX_SANDBOX_ENV_VALUE_LENGTH = 32 * 1024;
export const sandboxEnvNameSchema = z
  .string()
  .max(128, 'Use at most 128 characters.')
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Use letters, digits and underscores, not starting with a digit.')
  .refine(name => !RESERVED_SANDBOX_ENV_NAMES.some(pattern => pattern.test(name)), {
    message: 'This name is reserved by Factory.',
  })
  // Names like `__proto__` or `toString` collide with object built-ins and would be dropped or stick around.
  .refine(name => !(name in Object.prototype), { message: "This name can't be used." });
export const sandboxEnvAppliesToSchema = z.enum(['build', 'runtime', 'both']);
export const sandboxEnvPathSchema = z.object({ id: uuidSchema, name: sandboxEnvNameSchema });
export const sandboxEnvSetBodySchema = z.object({
  value: z
    .string()
    .max(MAX_SANDBOX_ENV_VALUE_LENGTH)
    // A NUL byte in an env value makes every spawn fail.
    .refine(value => !value.includes('\0'), { message: "Values can't contain NUL characters." }),
  appliesTo: sandboxEnvAppliesToSchema,
});
export const sandboxEnvUpdateBodySchema = z.object({ appliesTo: sandboxEnvAppliesToSchema });
/** A variable as routes return it. There is deliberately no value field. */
export const sandboxEnvSchema = z.object({
  name: z.string(),
  appliesTo: sandboxEnvAppliesToSchema,
  updatedAt: z.string(),
  updatedBy: z.string(),
});
export const sandboxEnvsListResponseSchema = z.object({
  envs: z.array(sandboxEnvSchema),
  /** False when values can't be stored encrypted, so writes are refused. */
  writable: z.boolean(),
});
export const sandboxEnvResponseSchema = z.object({ env: sandboxEnvSchema });

export const projectEnvironmentResponseSchema = z.object({
  environment: z.object({
    sandbox: environmentSandboxSchema,
    /** The stored settings document; only keys the user set. */
    settings: z.record(z.string(), z.unknown()),
    sandboxWorkingDirectory: z.string().nullable(),
    workspaceSetupCommand: z.string().nullable(),
    activeTemplateId: z.string().nullable(),
    activeTemplateHeads: z.record(z.string(), z.string()).nullable(),
    repositories: z.array(environmentRepositorySchema),
    buildTriggers: environmentBuildTriggersSchema.optional(),
    build: environmentLastBuildSchema.nullable().optional(),
  }),
});

export const environmentRepositoryPatchSchema = z.object({
  projectRepositoryId: uuidSchema,
  position: z.number().int().min(1).optional(),
  inEnvironment: z.boolean().optional(),
  setupCommand: nullableTrimmed(2_000).optional(),
  teardownCommand: nullableTrimmed(2_000).optional(),
});

export const updateProjectEnvironmentBodySchema = z
  .object({
    sandboxWorkingDirectory: nullableTrimmed(1_000)
      .refine(value => value === null || value.startsWith('/'), {
        message: 'sandboxWorkingDirectory must be absolute',
      })
      .optional(),
    /** Partial settings merged onto the stored document; null removes a key. Validated by the FactorySandbox. */
    settings: z.record(z.string(), z.unknown().nullable()).optional(),
    workspaceSetupCommand: nullableTrimmed(2_000).optional(),
    /** Build triggers; only accepted when the sandbox can build. */
    buildTriggers: z
      .object({
        schedule: z
          .object({
            enabled: z.boolean(),
            cron: z.string().trim().min(1).max(100).optional(),
            timezone: z.string().trim().min(1).max(100).optional(),
          })
          .optional(),
        push: z
          .object({
            enabled: z.boolean().optional(),
            debounceMinutes: z.number().int().min(0).max(1_440).optional(),
          })
          .optional(),
      })
      .optional(),
    repositories: z
      .array(environmentRepositoryPatchSchema)
      .max(100)
      .superRefine((entries, ctx) => {
        const ids = new Set(entries.map(entry => entry.projectRepositoryId));
        if (ids.size !== entries.length) {
          ctx.addIssue({ code: 'custom', message: 'Each repository may be listed once' });
        }
        const positions = entries.flatMap(entry => (entry.position === undefined ? [] : [entry.position]));
        if (positions.length === 0) return;
        const expected = Array.from({ length: entries.length }, (_, index) => index + 1);
        if (
          positions.length !== entries.length ||
          [...positions].sort((a, b) => a - b).some((p, i) => p !== expected[i])
        ) {
          ctx.addIssue({
            code: 'custom',
            message: 'Positions must be a permutation of 1..n over the listed repositories',
          });
        }
      })
      .optional(),
  })
  .refine(input => Object.keys(input).length > 0, { message: 'At least one environment field is required' });
