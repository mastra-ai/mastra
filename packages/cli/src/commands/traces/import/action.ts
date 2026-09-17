import { join } from 'node:path';
import * as p from '@clack/prompts';
import { config } from 'dotenv';
import { getCurrentOrgId, getToken } from '../../auth/credentials.js';
import { resolveProject } from '../../env/resolve-project.js';
import type { TraceImportCommandOptions } from './command.js';
import {
  assertTraceImportResumeCompatible,
  initializeTraceImport,
  readTraceImportManifest,
  resolveTraceImportDirectory,
} from './manifest.js';
import { completeTraceImport, prepareTraceImport } from './prepared-traces.js';
import type { TraceImportProvider } from './provider.js';
import { LangfuseTraceImportProvider } from './providers/langfuse/adapter.js';
import { createTraceImportReport, writeTraceImportReport } from './report.js';
import type { TraceImportTarget } from './target.js';
import { MastraPlatformTraceTarget } from './targets/mastra-platform.js';
import type { TraceImportManifest, TraceImportReport, TraceImportWindow } from './types.js';
import { uploadTraceImport } from './upload.js';
import { verifyTraceImport } from './verification.js';
import type { TraceImportVerifier } from './verifier.js';

const DEFAULT_LANGFUSE_BASE_URL = 'https://cloud.langfuse.com';
const DEFAULT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

interface PlatformDestination {
  accessToken?: string;
  projectId: string;
  projectName: string;
}

type PlatformTarget = TraceImportTarget & TraceImportVerifier;

export interface TraceImportUi {
  intro(message: string): void;
  step(message: string): void;
  note(message: string, title?: string): void;
  success(message: string): void;
  warn(message: string): void;
  cancel(message: string): void;
  outro(message: string): void;
  confirm(message: string): Promise<boolean>;
}

export interface RunTraceImportOptions extends TraceImportCommandOptions {
  provider: string;
  signal?: AbortSignal;
}

export interface TraceImportActionDependencies {
  environment?: NodeJS.ProcessEnv;
  now?: () => Date;
  stateRoot?: string;
  ui?: TraceImportUi;
  resolveDestination?: (project: string | undefined, environment: NodeJS.ProcessEnv) => Promise<PlatformDestination>;
  createProvider?: (provider: string, environment: NodeJS.ProcessEnv) => TraceImportProvider;
  createTarget?: (destination: PlatformDestination) => PlatformTarget;
  verifyImport?: typeof verifyTraceImport;
}

export type TraceImportActionResult =
  | { status: 'dry-run' | 'cancelled' | 'complete'; report: TraceImportReport }
  | { status: 'paused'; report: TraceImportReport };

function defaultUi(): TraceImportUi {
  return {
    intro: p.intro,
    step: p.log.step,
    note: p.note,
    success: p.log.success,
    warn: p.log.warn,
    cancel: p.cancel,
    outro: p.outro,
    confirm: async message => {
      const answer = await p.confirm({ message });
      return !p.isCancel(answer) && answer;
    },
  };
}

async function defaultResolveDestination(
  project: string | undefined,
  environment: NodeJS.ProcessEnv,
): Promise<PlatformDestination> {
  const token = await getToken();
  const usesEnvironmentToken = Boolean(process.env.MASTRA_API_TOKEN);
  const orgId = usesEnvironmentToken ? process.env.MASTRA_ORG_ID : await getCurrentOrgId();
  if (!orgId) {
    if (usesEnvironmentToken) {
      throw new Error('MASTRA_ORG_ID is required when MASTRA_API_TOKEN is set.');
    }
    throw new Error('No organization selected. Run: mastra auth orgs switch');
  }
  const resolved = await resolveProject(token, orgId, project);
  const accessToken = usesEnvironmentToken ? token : environment.MASTRA_PLATFORM_ACCESS_TOKEN?.trim();
  return {
    ...(accessToken ? { accessToken } : {}),
    projectId: resolved.id,
    projectName: resolved.name,
  };
}

function defaultCreateTarget(destination: PlatformDestination): PlatformTarget {
  if (!destination.accessToken) {
    throw new Error(
      'MASTRA_PLATFORM_ACCESS_TOKEN is required to upload and verify traces when using an interactive Mastra login.',
    );
  }
  return new MastraPlatformTraceTarget({
    accessToken: destination.accessToken,
    projectId: destination.projectId,
  });
}

function requireEnvironment(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function defaultCreateProvider(provider: string, environment: NodeJS.ProcessEnv): TraceImportProvider {
  if (provider !== 'langfuse') throw new Error(`Unsupported trace import provider: ${provider}`);
  return new LangfuseTraceImportProvider({
    baseUrl: environment.LANGFUSE_BASE_URL?.trim() || DEFAULT_LANGFUSE_BASE_URL,
    publicKey: requireEnvironment(environment, 'LANGFUSE_PUBLIC_KEY'),
    secretKey: requireEnvironment(environment, 'LANGFUSE_SECRET_KEY'),
  });
}

function parseDate(value: string, option: '--from' | '--to'): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`${option} must be a valid ISO 8601 date or timestamp.`);
  return timestamp;
}

export function resolveTraceImportWindow(
  options: Pick<TraceImportCommandOptions, 'from' | 'to'>,
  now = new Date(),
): TraceImportWindow {
  const nowMs = now.getTime();
  const retentionStartMs = nowMs - DEFAULT_WINDOW_MS;
  const snapshotMs = options.to ? parseDate(options.to, '--to') : nowMs;
  const cutoffMs = options.from
    ? parseDate(options.from, '--from')
    : Math.max(snapshotMs - DEFAULT_WINDOW_MS, retentionStartMs);

  if (snapshotMs > nowMs) throw new Error('--to cannot be in the future.');
  if (snapshotMs <= retentionStartMs) {
    throw new Error('--to must be within the last 30 days because older Platform telemetry is not retained.');
  }
  if (cutoffMs >= snapshotMs) throw new Error('--from must be earlier than --to.');
  if (snapshotMs - cutoffMs > DEFAULT_WINDOW_MS) {
    throw new Error('The trace import window cannot exceed 30 days.');
  }
  if (cutoffMs < retentionStartMs) {
    throw new Error('--from must be within the last 30 days because older Platform telemetry is not retained.');
  }

  return { cutoffAt: new Date(cutoffMs).toISOString(), snapshotAt: new Date(snapshotMs).toISOString() };
}

function resumeCommand(manifest: TraceImportManifest): string {
  return `mastra traces import ${manifest.source.provider} --resume ${manifest.importId} --project ${manifest.targetProjectId}`;
}

function resumableError(cause: unknown, manifest: TraceImportManifest): Error {
  const message = cause instanceof Error ? cause.message : 'Trace import failed.';
  return new Error(`${message}\nResume with:\n${resumeCommand(manifest)}`, { cause });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB'];
  let value = bytes / 1024;
  let unit = units[0]!;
  for (let index = 1; index < units.length && value >= 1024; index++) {
    value /= 1024;
    unit = units[index]!;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;
}

function preparationSummary(manifest: TraceImportManifest, destination: PlatformDestination): string {
  return [
    `Import ID:       ${manifest.importId}`,
    `Source project:  ${manifest.source.projectId}`,
    `Target project:  ${destination.projectName} (${manifest.targetProjectId})`,
    `Window:          ${manifest.window.cutoffAt} to ${manifest.window.snapshotAt}`,
    `Prepared:        ${manifest.counts.preparedTraces} traces / ${manifest.counts.preparedSpans} spans`,
    `Skipped:         ${manifest.counts.skippedTraces} traces / ${manifest.counts.skippedSpans} spans`,
    `Local data:      ${formatBytes(manifest.preparedBytes)}`,
  ].join('\n');
}

async function prepareNewImport(options: {
  providerName: string;
  provider: TraceImportProvider;
  destination: PlatformDestination;
  window: TraceImportWindow;
  stateRoot?: string;
  signal?: AbortSignal;
}): Promise<{ directory: string; manifest: TraceImportManifest }> {
  const source = await options.provider.identify(options.signal);
  if (source.provider !== options.providerName) {
    throw new Error(`The ${options.providerName} adapter identified itself as ${source.provider}.`);
  }
  const state = await initializeTraceImport({
    stateRoot: options.stateRoot,
    source,
    targetProjectId: options.destination.projectId,
    window: options.window,
  });
  try {
    return {
      directory: state.directory,
      manifest: await prepareTraceImport({
        directory: state.directory,
        provider: options.provider,
        signal: options.signal,
      }),
    };
  } catch (cause) {
    throw resumableError(cause, state.manifest);
  }
}

async function resumeImport(options: {
  importId: string;
  providerName: string;
  destination: PlatformDestination;
  environment: NodeJS.ProcessEnv;
  stateRoot?: string;
  signal?: AbortSignal;
  createProvider: (provider: string, environment: NodeJS.ProcessEnv) => TraceImportProvider;
}): Promise<{ directory: string; manifest: TraceImportManifest }> {
  const directory = resolveTraceImportDirectory({
    stateRoot: options.stateRoot,
    targetProjectId: options.destination.projectId,
    importId: options.importId,
  });
  let manifest = await readTraceImportManifest(directory);
  if (manifest.source.provider !== options.providerName) {
    throw new Error(`Import ${manifest.importId} was prepared with provider ${manifest.source.provider}.`);
  }
  if (manifest.targetProjectId !== options.destination.projectId) {
    throw new Error('Cannot resume because the target project changed.');
  }

  if (manifest.phase === 'preparing') {
    const provider = options.createProvider(options.providerName, options.environment);
    const source = await provider.identify(options.signal);
    assertTraceImportResumeCompatible(manifest, { source, targetProjectId: options.destination.projectId });
    try {
      manifest = await prepareTraceImport({ directory, provider, signal: options.signal });
    } catch (cause) {
      throw resumableError(cause, manifest);
    }
  }
  return { directory, manifest };
}

export async function runTraceImport(
  options: RunTraceImportOptions,
  dependencies: TraceImportActionDependencies = {},
): Promise<TraceImportActionResult> {
  if (options.resume && (options.from || options.to)) {
    throw new Error('--from and --to cannot be changed while resuming an import.');
  }
  if (options.resume && options.dryRun) {
    throw new Error('--dry-run cannot be combined with --resume.');
  }

  const environment = dependencies.environment ?? process.env;
  const ui = dependencies.ui ?? defaultUi();
  const createProvider = dependencies.createProvider ?? defaultCreateProvider;
  const resolveDestination = dependencies.resolveDestination ?? defaultResolveDestination;
  const createTarget = dependencies.createTarget ?? defaultCreateTarget;
  const verifyImport = dependencies.verifyImport ?? verifyTraceImport;

  ui.intro('Mastra trace import');
  ui.step('Resolving Mastra Platform project');
  const destination = await resolveDestination(options.project, environment);
  options.signal?.throwIfAborted();

  let state: { directory: string; manifest: TraceImportManifest };
  if (options.resume) {
    ui.step(`Loading import ${options.resume}`);
    state = await resumeImport({
      importId: options.resume,
      providerName: options.provider,
      destination,
      environment,
      stateRoot: dependencies.stateRoot,
      signal: options.signal,
      createProvider,
    });
  } else {
    ui.step(`Reading ${options.provider} traces`);
    const provider = createProvider(options.provider, environment);
    state = await prepareNewImport({
      providerName: options.provider,
      provider,
      destination,
      window: resolveTraceImportWindow(options, dependencies.now?.() ?? new Date()),
      stateRoot: dependencies.stateRoot,
      signal: options.signal,
    });
  }

  ui.note(preparationSummary(state.manifest, destination), 'Prepared trace import');
  if (state.manifest.warnings.length > 0) {
    ui.warn(`${state.manifest.warnings.length} provider warning(s) were recorded in the report.`);
  }

  if (options.dryRun) {
    const report = await writeTraceImportReport(state.directory, state.manifest);
    ui.outro(`Dry run complete. Upload later with:\n${resumeCommand(state.manifest)}`);
    return { status: 'dry-run', report };
  }

  if (state.manifest.phase === 'complete') {
    state.manifest = await completeTraceImport(state.directory);
    const report = createTraceImportReport(state.directory, state.manifest);
    ui.outro('This trace import is already complete.');
    return { status: 'complete', report };
  }

  const hasPendingUpload =
    state.manifest.acknowledgedTraces !== state.manifest.counts.preparedTraces ||
    state.manifest.acknowledgedSpans !== state.manifest.counts.preparedSpans;
  if (hasPendingUpload) {
    const shouldUpload = options.yes || (await ui.confirm('Upload these traces to Mastra Platform?'));
    if (!shouldUpload) {
      const report = await writeTraceImportReport(state.directory, state.manifest);
      ui.cancel(`Upload cancelled. Resume later with:\n${resumeCommand(state.manifest)}`);
      return { status: 'cancelled', report };
    }
  }

  const target = createTarget(destination);
  if (hasPendingUpload) {
    ui.step('Uploading prepared traces');
    try {
      state.manifest = await uploadTraceImport({ directory: state.directory, target, signal: options.signal });
    } catch (cause) {
      throw resumableError(cause, state.manifest);
    }
  }

  ui.step('Verifying a sample through Mastra Platform');
  let report: TraceImportReport;
  try {
    report = await verifyImport({ directory: state.directory, verifier: target, signal: options.signal });
  } catch (cause) {
    throw resumableError(cause, state.manifest);
  }
  if (report.phase !== 'complete') {
    ui.warn(`Verification ${report.verification.status}. Prepared data was kept for another attempt.`);
    ui.outro(`Resume with:\n${resumeCommand(state.manifest)}`);
    return { status: 'paused', report };
  }

  ui.success(`Imported ${report.acknowledgedTraces} traces / ${report.acknowledgedSpans} spans.`);
  ui.outro(`Trace import complete. Report: ${report.stateDirectory}/report.json`);
  return { status: 'complete', report };
}

export async function traceImportAction(provider: string, options: TraceImportCommandOptions): Promise<void> {
  config({ path: [join(process.cwd(), '.env'), join(process.cwd(), '.env.local')], quiet: true });

  const controller = new AbortController();
  const abort = () => controller.abort(new Error('Trace import interrupted.'));
  process.once('SIGINT', abort);
  process.once('SIGTERM', abort);

  try {
    const result = await runTraceImport({ ...options, provider, signal: controller.signal });
    if (result.status === 'paused') {
      throw new Error(
        `Trace import paused because verification ${result.report.verification.status}. See ${result.report.stateDirectory}/report.json.`,
      );
    }
  } finally {
    process.removeListener('SIGINT', abort);
    process.removeListener('SIGTERM', abort);
  }
}
