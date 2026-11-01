import { isAbsolute, relative, resolve, sep } from 'node:path';
import { z } from 'zod';
import type { OpenAICompatibleConfig } from '@mastra/core/llm';
import { parseCron } from '../investigation/schedule.js';

export const KATANA_BASE =
  'projectdiscovery/katana@sha256:20c42a63b71f0c2e95cb02d973e8887e70ad65ea9cb818183f163143275e746c';
export const IMAGE_OWNER = 'security-scanner-runtime-v1';

const booleanSetting = z.enum(['true', 'false']).transform(value => value === 'true');
const integerSetting = (minimum: number, maximum: number, fallback: string) =>
  z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(minimum).max(maximum)).prefault(fallback);

const environmentSchema = z
  .object({
    DISCOVERY_DRIVER: z.literal('katana').default('katana'),
    SANDBOX_DRIVER: z.literal('docker').default('docker'),
    QUEUE_DRIVER: z.literal('libsql').default('libsql'),
    STORAGE_DRIVER: z.literal('libsql').default('libsql'),
    DATABASE_URL: z
      .string()
      .regex(/^file:\.\/data\/[a-zA-Z0-9_-]+\.db$/)
      .default('file:./data/security-scanner.db'),
    DOCKER_DISCOVERY_IMAGE: z
      .string()
      .regex(/^security-scanner\/katana:[a-zA-Z0-9_.-]+$/)
      .default('security-scanner/katana:1.8.0'),
    DOCKER_PLATFORM: z.enum(['linux/arm64', 'linux/amd64']).default('linux/arm64'),
    DOCKER_SOCKET: z
      .string()
      .max(4096)
      .regex(/^\/[^\0\r\n]+$/)
      .default('/var/run/docker.sock'),
    DOCKER_RETAIN_SHARED_BASE_IMAGE: booleanSetting.prefault('false'),
    DOCKER_REMOVE_SCAN_IMAGES: z.literal('true').default('true'),
    SCANNER_DISCOVERY_ENABLED: booleanSetting.prefault('false'),
    SCANNER_INVESTIGATION_ENABLED: booleanSetting.prefault('false'),
    SCANNER_ADVISORY_SYNC_ENABLED: booleanSetting.prefault('false'),
    SCANNER_ADVISORY_SYNC_CRON: z
      .string()
      .max(100)
      .refine(value => parseCron(value) !== null)
      .optional(),
    SCANNER_ADVISORY_SYNC_TIMEZONE: z
      .string()
      .min(1)
      .max(100)
      .refine(value => {
        if (value !== 'UTC' && !/^[A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$/.test(value)) return false;
        try {
          new Intl.DateTimeFormat('en', { timeZone: value });
          return true;
        } catch {
          return false;
        }
      })
      .optional(),
    SANDBOX_MEMORY_MIB: integerSetting(512, 2048, '1024'),
    SANDBOX_PIDS: integerSetting(64, 512, '256'),
    COMMAND_TIMEOUT_MS: integerSetting(1000, 60000, '20000'),
    OUTPUT_LIMIT_BYTES: integerSetting(1024, 65536, '8192'),
    CONTROL_SESSION_TTL_SECONDS: integerSetting(1, 3600, '1800'),
    CONTROL_BOOTSTRAP_SECRET: z
      .string()
      .min(32)
      .max(256)
      .regex(/^[a-zA-Z0-9_-]+$/)
      .optional(),
    SCANNER_ENCRYPTION_KEY: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    PORT: integerSetting(1024, 65535, '4111'),
    EXPLORER_MODEL: z.literal('morph-dsv41flash-abliterated').default('morph-dsv41flash-abliterated'),
    JUDGE_MODEL: z.literal('morph/morph-glm53-744b').default('morph/morph-glm53-744b'),
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

export type Settings = ReturnType<typeof loadSettings>;

export function diagnostic(error: unknown) {
  return error instanceof RuntimeDiagnostic
    ? { code: error.code, message: error.message }
    : { code: 'RUNTIME_FAILURE', message: 'Runtime operation failed. Check local prerequisites and retry.' };
}

export function hasMorphApiKey(environment: NodeJS.ProcessEnv = process.env) {
  return typeof environment.MORPH_API_KEY === 'string' && environment.MORPH_API_KEY.trim().length > 0;
}

export function morphModelDescriptor(settings: Settings) {
  const common = { providerId: 'morph', url: 'https://api.morphllm.com/v1', api: 'chat' as const };
  return {
    explorer: { ...common, modelId: settings.EXPLORER_MODEL } satisfies OpenAICompatibleConfig,
    judge: { ...common, modelId: settings.JUDGE_MODEL.slice('morph/'.length) } satisfies OpenAICompatibleConfig,
  };
}

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
