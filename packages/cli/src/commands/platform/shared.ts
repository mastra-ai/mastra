import type { MastraPlatform } from '@mastra/platform';
import type { Command } from 'commander';
import pc from 'picocolors';
import { MASTRA_PLATFORM_API_URL } from '../auth/client.js';
import { getToken, getCurrentOrgId } from '../auth/credentials.js';
import { loadProjectConfig } from '../studio/project-config.js';

export interface PlatformOptions {
  org?: string;
  project?: string;
  json?: boolean;
  /** Commander sets `wait: false` for `--no-wait`. */
  wait?: boolean;
}

/** A top-level command that works on Mastra Platform, with `--org`, `--json` and (by default) `--project`. */
export function platformCommand(program: Command, name: string, description: string, { project = true } = {}) {
  const command = program
    .command(name)
    .description(description)
    .option('--org <id>', 'Organization ID (defaults to MASTRA_ORG_ID, then the current organization)');
  if (project) {
    command.option('--project <id>', 'Project ID or slug (defaults to MASTRA_PROJECT_ID, then the linked project)');
  }
  return command.option('--json', 'Print JSON');
}

/** Options merged from every level, so `--project` works before or after a subcommand. */
export function options<T extends object = {}>(command: Command): PlatformOptions & T {
  return command.optsWithGlobals() as PlatformOptions & T;
}

/** The signed-in user's client for the organization, scoped to no project. */
export async function organizationClient(opts: PlatformOptions): Promise<MastraPlatform> {
  const accessToken = await getToken();
  const organizationId = opts.org ?? process.env.MASTRA_ORG_ID ?? (await getCurrentOrgId()) ?? undefined;
  if (!organizationId) throw new Error('No organization selected. Run: mastra auth orgs switch');
  // Loaded on use: the SDK pulls in the browser and sandbox clients, which other commands don't need.
  const { MastraPlatform } = await import('@mastra/platform');
  return new MastraPlatform({ accessToken, organizationId, apiUrl: MASTRA_PLATFORM_API_URL });
}

/** The client for `--project`, `MASTRA_PROJECT_ID` or the linked project, matching `--project` by id or slug. */
export async function projectClient(opts: PlatformOptions): Promise<MastraPlatform> {
  const platform = await organizationClient(opts);
  if (opts.project) {
    const projects = await platform.projects.list();
    const match = projects.find(p => p.id === opts.project || p.slug === opts.project);
    return platform.project(match?.id ?? opts.project);
  }
  const projectId = process.env.MASTRA_PROJECT_ID ?? (await loadProjectConfig(process.cwd()))?.projectId;
  if (!projectId) {
    throw new Error(
      'No project selected. Pass --project <id>, set MASTRA_PROJECT_ID, or run `mastra projects create`.',
    );
  }
  return platform.project(projectId);
}

/** The environment named by `--env` (id, slug or name), or the project's production environment. */
export async function environmentId(platform: MastraPlatform, env?: string): Promise<string> {
  const environments = await platform.environments.list();
  const match = env
    ? environments.find(e => e.id === env || e.slug === env || e.name === env)
    : environments.find(e => e.type === 'production');
  if (!match) throw new Error(env ? `Environment ${env} not found` : 'The project has no production environment');
  return match.id;
}

export function print(opts: PlatformOptions, value: unknown, human: () => string) {
  console.info(opts.json ? JSON.stringify(value, null, 2) : human());
}

export function table(items: readonly object[], columns: string[]): string {
  const rows = items as readonly Record<string, unknown>[];
  if (rows.length === 0) return pc.dim('None.');
  const cell = (value: unknown) => (value === null || value === undefined ? '-' : String(value));
  const widths = columns.map(col => Math.max(col.length, ...rows.map(row => cell(row[col]).length)));
  const line = (values: string[]) =>
    values
      .map((v, i) => v.padEnd(widths[i]!))
      .join('  ')
      .trimEnd();
  return [pc.bold(line(columns)), ...rows.map(row => line(columns.map(col => cell(row[col]))))].join('\n');
}

/** Creates a resource and, unless `--no-wait`, waits until it is ready. */
export async function provision<T extends { id: string; status: string }>(
  opts: PlatformOptions,
  label: string,
  create: () => Promise<T>,
  waitUntilReady: (id: string) => Promise<T>,
): Promise<T> {
  const created = await create();
  if (opts.wait === false || created.status === 'ready') return created;
  if (!opts.json) console.info(pc.dim(`Provisioning ${label} ${created.id}...`));
  return waitUntilReady(created.id);
}
