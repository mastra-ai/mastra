import { isAbsolute, relative, resolve, sep } from 'node:path';
import { z } from 'zod';
import type { OpenAICompatibleConfig } from '@mastra/core/llm';
import { parseCron } from '../investigation/schedule.js';
import { INSTANCE_DATABASE_NAME } from './storage-names.js';

export const KATANA_BASE =
  'projectdiscovery/katana@sha256:20c42a63b71f0c2e95cb02d973e8887e70ad65ea9cb818183f163143275e746c';
export const IMAGE_OWNER = 'security-scanner-runtime-v1';

const booleanSetting = z.enum(['true', 'false']).transform(value => value === 'true');
// Morph aliases may include the same optional provider namespace used by the default judge.
const morphModelId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^(?:morph\/)?[a-zA-Z0-9][a-zA-Z0-9._-]*$/);
const integerSetting = (minimum: number, maximum: number, fallback: string) =>
  z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(minimum).max(maximum)).prefault(fallback);

const environmentSchema = z
  .object({
    /** Supported discovery implementation. */
    DISCOVERY_DRIVER: z.literal('katana').default('katana'),
    /** Supported local sandbox implementation. */
    SANDBOX_DRIVER: z.literal('docker').default('docker'),
    /** Durable local queue implementation. */
    QUEUE_DRIVER: z.literal('libsql').default('libsql'),
    /** Local persistence implementation. */
    STORAGE_DRIVER: z.literal('libsql').default('libsql'),
    /** Relative file URL under data/ for application-owned state. */
    DATABASE_URL: z
      .string()
      .regex(/^file:\.\/data\/[a-zA-Z0-9_-]+\.db$/)
      .refine(value => {
        const application = value.slice('file:./data/'.length);
        const native = application.replace(/\.db$/, '-mastra.db');
        return [application, native].every(name => name.toLowerCase() !== INSTANCE_DATABASE_NAME);
      })
      .default('file:./data/security-scanner.db'),
    /** Local tag for the image built from pinned Katana inputs. */
    DOCKER_DISCOVERY_IMAGE: z
      .string()
      .regex(/^security-scanner\/katana:[a-zA-Z0-9_.-]+$/)
      .default('security-scanner/katana:1.8.0'),
    /** Supported native Linux Docker platform for the pinned crawler and browser. */
    DOCKER_PLATFORM: z.literal('linux/arm64').default('linux/arm64'),
    /** Absolute local Docker Unix socket path. */
    DOCKER_SOCKET: z
      .string()
      .max(4096)
      .regex(/^\/[^\0\r\n]+$/)
      .default('/var/run/docker.sock'),
    /** Whether to retain the owned base image after its consumers stop. */
    DOCKER_RETAIN_SHARED_BASE_IMAGE: booleanSetting.prefault('false'),
    /** Required cleanup policy for owned ephemeral scan images. */
    DOCKER_REMOVE_SCAN_IMAGES: z.literal('true').default('true'),
    /** Explicit opt-in to authorized discovery and confined identity checks. */
    SCANNER_DISCOVERY_ENABLED: booleanSetting.prefault('false'),
    /** Explicit opt-in to planning and reassessment; enabled models can incur charges. */
    SCANNER_INVESTIGATION_ENABLED: booleanSetting.prefault('false'),
    /** Explicit opt-in to scheduled external advisory synchronization. */
    SCANNER_ADVISORY_SYNC_ENABLED: booleanSetting.prefault('false'),
    /** Explicit five-field cadence for advisory synchronization. */
    SCANNER_ADVISORY_SYNC_CRON: z
      .string()
      .max(100)
      .refine(value => parseCron(value) !== null)
      .optional(),
    /** Explicit IANA timezone for advisory synchronization. */
    SCANNER_ADVISORY_SYNC_TIMEZONE: z
      .string()
      .min(1)
      .max(100)
      .refine(value => {
        if (value !== 'UTC' && !/^[A-Za-z0-9_+-]+\/[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)?$/.test(value)) return false;
        try {
          new Intl.DateTimeFormat('en', { timeZone: value });
          return true;
        } catch {
          return false;
        }
      })
      .optional(),
    /** Sandbox memory ceiling in mebibytes. */
    SANDBOX_MEMORY_MIB: integerSetting(512, 2048, '1024'),
    /** Maximum sandbox process count, including browser children. */
    SANDBOX_PIDS: integerSetting(64, 512, '256'),
    /** Timeout in milliseconds for bounded runtime commands. */
    COMMAND_TIMEOUT_MS: integerSetting(1000, 60000, '20000'),
    /** Retained-output byte ceiling for setup and diagnostic commands. */
    OUTPUT_LIMIT_BYTES: integerSetting(1024, 65536, '8192'),
    /** Fixed local session lifetime in seconds. */
    CONTROL_SESSION_TTL_SECONDS: integerSetting(1, 3600, '1800'),
    /** Private random secret used only to establish the local operator session. */
    CONTROL_BOOTSTRAP_SECRET: z
      .string()
      .min(32)
      .max(256)
      .regex(/^[a-zA-Z0-9_-]+$/)
      .optional(),
    /** Private 32-byte credential-encryption key encoded as lowercase hexadecimal. */
    SCANNER_ENCRYPTION_KEY: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    /** Loopback HTTP listener port. */
    PORT: integerSetting(1024, 65535, '4111'),
    /** Morph model alias used by Nemo, Sherlock, and Dupin. */
    EXPLORER_MODEL: morphModelId.default('morph-dsv41flash-abliterated'),
    /** Morph model alias used for independent Watson review. */
    JUDGE_MODEL: morphModelId.default('morph/morph-glm53-744b'),
  })
  .superRefine((settings, context) => {
    if (
      settings.SCANNER_ADVISORY_SYNC_ENABLED &&
      (!settings.SCANNER_ADVISORY_SYNC_CRON || !settings.SCANNER_ADVISORY_SYNC_TIMEZONE)
    )
      context.addIssue({
        code: 'custom',
        path: ['SCANNER_ADVISORY_SYNC_ENABLED'],
        message: 'Explicit cadence and timezone are required.',
      });
  });

export class RuntimeDiagnostic extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'RuntimeDiagnostic';
  }
}

/** Validate environment settings and resolve runtime paths beneath the selected project root. */
export function loadSettings(environment: NodeJS.ProcessEnv = process.env, root = process.cwd()) {
  const parsed = environmentSchema.safeParse(environment);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map(issue => issue.path.join('.')))].join(', ');
    throw new RuntimeDiagnostic('INVALID_CONFIGURATION', `Check supported values for: ${fields}.`);
  }
  const settings = parsed.data;
  const applicationRoot = resolve(root);
  const databasePath = resolve(applicationRoot, settings.DATABASE_URL.slice(5));
  const mastraDatabasePath = databasePath.replace(/\.db$/, '-mastra.db');
  const dataDirectory = resolve(applicationRoot, 'data');
  const inside = relative(dataDirectory, databasePath);
  if (isAbsolute(inside) || inside.startsWith(`..${sep}`)) {
    throw new RuntimeDiagnostic('INVALID_CONFIGURATION', 'The database must be inside the local data directory.');
  }
  return {
    ...settings,
    root: applicationRoot,
    dataDirectory,
    databasePath,
    databaseUrl: `file:${databasePath}`,
    mastraDatabasePath,
    mastraDatabaseUrl: `file:${mastraDatabasePath}`,
    imageReceiptPath: resolve(dataDirectory, 'runtime-image.json'),
  };
}

/** Validated runtime settings with absolute application/native storage paths. */
export type Settings = ReturnType<typeof loadSettings>;

/** Convert an unknown runtime error into a safe diagnostic without exporting raw error details. */
export function diagnostic(error: unknown) {
  return error instanceof RuntimeDiagnostic
    ? { code: error.code, message: error.message }
    : { code: 'RUNTIME_FAILURE', message: 'Runtime operation failed. Check local prerequisites and retry.' };
}

/** Report whether a nonempty Morph credential is available without exposing its value. */
export function hasMorphApiKey(environment: NodeJS.ProcessEnv = process.env) {
  return typeof environment.MORPH_API_KEY === 'string' && environment.MORPH_API_KEY.trim().length > 0;
}

export function morphModelDescriptor(settings: Settings) {
  const common = { providerId: 'morph', url: 'https://api.morphllm.com/v1', api: 'chat' as const };
  return {
    explorer: { ...common, modelId: settings.EXPLORER_MODEL.replace(/^morph\//, '') } satisfies OpenAICompatibleConfig,
    judge: { ...common, modelId: settings.JUDGE_MODEL.replace(/^morph\//, '') } satisfies OpenAICompatibleConfig,
  };
}

/** Build Morph model configuration only when its required credential is available. */
export function morphModelConfiguration(settings: Settings, environment: NodeJS.ProcessEnv = process.env) {
  if (!hasMorphApiKey(environment))
    throw new RuntimeDiagnostic('MORPH_API_KEY_REQUIRED', 'Set MORPH_API_KEY before enabling investigation models.');
  const descriptor = morphModelDescriptor(settings);
  const apiKey = environment.MORPH_API_KEY!;
  return {
    explorer: { ...descriptor.explorer, apiKey } satisfies OpenAICompatibleConfig,
    judge: { ...descriptor.judge, apiKey } satisfies OpenAICompatibleConfig,
  };
}
