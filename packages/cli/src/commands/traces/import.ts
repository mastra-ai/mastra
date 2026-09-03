import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import * as p from '@clack/prompts';
import { runTraceImport, TRACE_IMPORT_MAPPER_VERSION, type TraceImportReport } from '@mastra/trace-import';
import { parse } from 'dotenv';
import pc from 'picocolors';
import { getAnalytics } from '../../analytics/index.js';
import { getCurrentOrgId, getToken } from '../auth/credentials.js';
import { fetchProjects, fetchTokenOrganizationId } from '../env/platform-api.js';
import { loadProjectConfig } from '../studio/project-config.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface TraceImportCliOptions {
  provider: string;
  project?: string;
  platformUrl?: string;
  environment?: string;
  dryRun?: boolean;
  resume?: string;
  stateDir?: string;
  batchSize?: number;
  maxStagingMb?: number;
  json?: boolean;
  yes?: boolean;
  keepState?: boolean;
}

function loadLocalEnv(): Record<string, string> {
  const path = resolve(process.cwd(), '.env');
  return existsSync(path) ? parse(readFileSync(path)) : {};
}

function envValue(env: Record<string, string>, name: string): string | undefined {
  return process.env[name] || env[name] || undefined;
}

async function resolveProjectId(
  projectOption: string | undefined,
  env: Record<string, string>,
  platformAccessToken?: string,
): Promise<string> {
  const projectConfig = await loadProjectConfig(process.cwd());
  const wanted = projectOption ?? envValue(env, 'MASTRA_PROJECT_ID') ?? projectConfig?.projectId;
  if (!wanted) {
    throw new Error(
      'No target project found. Pass --project, set MASTRA_PROJECT_ID, or run from a linked Mastra project.',
    );
  }
  if (
    wanted === projectConfig?.projectId ||
    wanted === projectConfig?.projectSlug ||
    wanted === projectConfig?.projectName
  ) {
    return projectConfig.projectId;
  }
  if (UUID.test(wanted)) return wanted;

  let token: string;
  let organizationId: string | null;
  if (platformAccessToken) {
    token = platformAccessToken;
    try {
      organizationId = await fetchTokenOrganizationId(platformAccessToken);
    } catch (cause) {
      throw new Error(
        `Project "${wanted}" is a slug, but the Platform credential could not be verified. Check MASTRA_PLATFORM_ACCESS_TOKEN or pass a project UUID.`,
        { cause },
      );
    }
  } else {
    try {
      [token, organizationId] = await Promise.all([getToken(undefined, { allowLogin: false }), getCurrentOrgId()]);
    } catch (cause) {
      throw new Error(
        `Project "${wanted}" is not a UUID and could not be resolved as a slug. Log in with mastra auth login or pass the project ID.`,
        { cause },
      );
    }
  }
  if (!organizationId) {
    throw new Error('No active Mastra organization is available to resolve the project slug.');
  }
  let projects: Awaited<ReturnType<typeof fetchProjects>>;
  try {
    projects = await fetchProjects(token, organizationId);
  } catch (cause) {
    throw new Error(
      `Could not resolve project "${wanted}" in the active organization. Pass a current project UUID or check the Platform credential.`,
      { cause },
    );
  }
  const projectBySlug = projects.find(candidate => candidate.slug === wanted);
  const projectsByName = projects.filter(candidate => candidate.name === wanted);
  if (!projectBySlug && projectsByName.length > 1) {
    throw new Error(`More than one project is named "${wanted}". Pass a unique project slug or project ID.`);
  }
  const project = projectBySlug ?? projectsByName[0];
  if (!project) {
    throw new Error(
      `Project "${wanted}" was not found in the active organization. It may be stale or deleted; pass a current project ID or slug.`,
    );
  }
  return project.id;
}

function printReport(report: TraceImportReport): void {
  p.log.info(`Import ID: ${report.importId}`);
  p.log.info(`Window: ${report.cutoffAt} → ${report.snapshotAt}`);
  p.log.info(`Langfuse: ${report.sourceBaseUrl} (${report.sourceProjectId ?? 'no observations found'})`);
  p.log.info(`Mastra project: ${report.targetProjectId} (${report.collectorOrigin})`);
  p.log.info(`Environment: ${report.environment ?? 'preserve each Langfuse observation environment'}`);
  p.log.info(
    `Read ${report.counts.readSpans} spans; ${report.counts.eligibleTraces} traces / ${report.counts.eligibleSpans} spans eligible; ${report.counts.skippedTraces} traces / ${report.counts.skippedSpans} spans skipped.`,
  );
  p.log.info(`Estimated upload: ${report.estimatedPayloadBytes} bytes`);
  p.log.info(`Resume with: mastra traces import --provider langfuse --resume ${report.importId}`);
}

function printVerification(report: TraceImportReport): void {
  const verification = report.verification;
  if (verification.status === 'verified') {
    p.log.success(
      `Verified ${verification.verifiedTraces}/${verification.sampledTraces} sampled traces through the Platform query API.`,
    );
    return;
  }
  if (verification.status !== 'not-performed') {
    p.log.warn(
      `Post-upload verification ${verification.status}: ${verification.verifiedTraces}/${verification.sampledTraces} sampled traces verified${verification.reason ? ` (${verification.reason})` : ''}`,
    );
  }
}

export async function traceImportAction(options: TraceImportCliOptions): Promise<void> {
  const startedAt = performance.now();
  const analytics = getAnalytics();
  if (options.provider.toLowerCase() !== 'langfuse') {
    throw new Error('V0 only supports --provider langfuse.');
  }
  const env = loadLocalEnv();
  const publicKey = envValue(env, 'LANGFUSE_PUBLIC_KEY');
  const secretKey = envValue(env, 'LANGFUSE_SECRET_KEY');
  const baseUrl = envValue(env, 'LANGFUSE_BASE_URL');
  const hasSourceCredentials = Boolean(publicKey || secretKey || baseUrl);
  if (hasSourceCredentials && (!publicKey || !secretKey || !baseUrl)) {
    throw new Error('LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, and LANGFUSE_BASE_URL must be provided together.');
  }
  if (!options.resume && (!publicKey || !secretKey || !baseUrl)) {
    throw new Error('LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, and LANGFUSE_BASE_URL are required.');
  }
  const source = publicKey && secretKey && baseUrl ? { baseUrl, publicKey, secretKey } : undefined;

  const preferredAccessToken = envValue(env, 'MASTRA_PLATFORM_ACCESS_TOKEN');
  const legacyAccessToken = envValue(env, 'MASTRA_CLOUD_ACCESS_TOKEN');
  const accessToken = preferredAccessToken ?? legacyAccessToken;
  const legacyTokenWarning =
    !preferredAccessToken && legacyAccessToken
      ? 'MASTRA_CLOUD_ACCESS_TOKEN is deprecated; rename it to MASTRA_PLATFORM_ACCESS_TOKEN.'
      : undefined;
  const projectId = await resolveProjectId(options.project, env, accessToken);
  const collectorUrl = options.platformUrl ?? envValue(env, 'MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT');
  if (!options.dryRun && !accessToken) {
    throw new Error(
      'MASTRA_PLATFORM_ACCESS_TOKEN is required for an import (MASTRA_CLOUD_ACCESS_TOKEN is accepted temporarily as a deprecated fallback). Use --dry-run to validate without it.',
    );
  }
  if (!options.dryRun && !accessToken?.startsWith('sk_')) {
    throw new Error(
      'MASTRA_PLATFORM_ACCESS_TOKEN must be an organization ingestion key beginning with "sk_"; the mastra auth login token is not accepted.',
    );
  }
  const stateRoot = options.stateDir
    ? isAbsolute(options.stateDir)
      ? options.stateDir
      : resolve(process.cwd(), options.stateDir)
    : undefined;

  const controller = new AbortController();
  let interrupted = false;
  const handleSigint = () => {
    interrupted = true;
    controller.abort(new Error('Interrupted'));
  };
  process.once('SIGINT', handleSigint);

  if (!options.json) p.intro(pc.cyan('Mastra Langfuse trace import'));
  try {
    const baseReport = await runTraceImport({
      source,
      target: {
        projectId,
        accessToken,
        collectorUrl,
        environment: options.environment,
      },
      stateRoot,
      resumeId: options.resume,
      dryRun: options.dryRun,
      keepState: options.keepState,
      batchSize: options.batchSize,
      maxStagingBytes: options.maxStagingMb === undefined ? undefined : options.maxStagingMb * 1024 * 1024,
      signal: controller.signal,
      confirm: options.yes
        ? undefined
        : async report => {
            if (options.json || !process.stdin.isTTY || !process.stdout.isTTY) {
              throw new Error('Interactive confirmation is unavailable. Re-run with --yes or --dry-run.');
            }
            printReport(report);
            const confirmed = await p.confirm({
              message: 'Upload these spans? Imported spans count against your observability quota.',
            });
            return !p.isCancel(confirmed) && confirmed;
          },
    });
    const report =
      legacyTokenWarning && !baseReport.warnings.includes(legacyTokenWarning)
        ? { ...baseReport, warnings: [legacyTokenWarning, ...baseReport.warnings] }
        : baseReport;

    if (options.json) {
      console.info(JSON.stringify(report));
    } else {
      if (options.yes || options.dryRun || report.status === 'paused') printReport(report);
      for (const warning of report.warnings) p.log.warn(warning);
      p.log.warn(report.consistencyWarning);
      if (report.status === 'complete') {
        printVerification(report);
        p.outro(`Enqueued ${report.counts.enqueuedSpans} spans. Platform storage is asynchronous.`);
      } else if (report.status === 'dry-run') {
        p.outro('Dry run complete; no spans were uploaded.');
      } else if (report.status === 'paused') {
        p.outro('Import paused safely. Resume it with the import ID shown above.');
      } else {
        p.outro('Import cancelled; staged state was retained for resume.');
      }
    }

    if (interrupted) process.exitCode = 130;
    else if (report.status === 'paused') process.exitCode = 2;
    analytics?.trackEvent('cli_trace_import', {
      provider: 'langfuse',
      mapperVersion: TRACE_IMPORT_MAPPER_VERSION,
      resumed: Boolean(options.resume),
      dryRun: Boolean(options.dryRun),
      status: report.status,
      durationMs: Math.round(performance.now() - startedAt),
      readSpans: report.counts.readSpans,
      eligibleTraces: report.counts.eligibleTraces,
      eligibleSpans: report.counts.eligibleSpans,
      skippedTraces: report.counts.skippedTraces,
      skippedSpans: report.counts.skippedSpans,
      enqueuedSpans: report.counts.enqueuedSpans,
      verifiedTraces: report.counts.verifiedTraces,
      truncationRiskSpans: report.counts.truncationRiskSpans,
      sourceRetries: report.counts.sourceRetries,
      targetRetries: report.counts.targetRetries,
      skipReasons: report.counts.skipReasons,
    });
  } catch (error) {
    analytics?.trackEvent('cli_trace_import', {
      provider: 'langfuse',
      mapperVersion: TRACE_IMPORT_MAPPER_VERSION,
      resumed: Boolean(options.resume),
      dryRun: Boolean(options.dryRun),
      status: 'error',
      durationMs: Math.round(performance.now() - startedAt),
    });
    throw error;
  } finally {
    process.removeListener('SIGINT', handleSigint);
  }
}
