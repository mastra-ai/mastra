/**
 * Unified deploy command: `mastra deploy [--env <name>]`
 *
 * This is the new entry point for deploying Mastra projects.
 * It replaces `mastra studio deploy` and `mastra server deploy`.
 *
 * - Auto-creates project if missing (from package.json name)
 * - Auto-creates environment if missing (with prompt or --yes)
 * - Deploys to the specified environment (default: production)
 */

import { execSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, rm, stat, access, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import * as p from '@clack/prompts';
import { analyzeEntryProjectType } from '@mastra/deployer/build';
import { ZipArchive } from 'archiver';
import pc from 'picocolors';

import { bucketApiHost, getAnalytics } from '../../analytics/index.js';
import type { CLI_ORIGIN } from '../../analytics/index.js';
import { writeBarLine } from '../../utils/clack-bar.js';
import { findMastraEntryFile } from '../../utils/find-mastra-entry.js';
import { runBuild } from '../../utils/run-build.js';
import { checkBuildStaleness } from '../../utils/source-hash.js';
import { fetchOrgs } from '../auth/api.js';
import { MASTRA_PLATFORM_API_URL, MASTRA_STUDIO_URL } from '../auth/client.js';
import { getToken, getCurrentOrgId } from '../auth/credentials.js';
import { fetchDatabases } from '../db/platform-api.js';
import type { ProjectDatabase } from '../db/platform-api.js';
import { mergePreflightEnvVars, preflightBuildOutput, printPreflightIssues } from '../deploy-preflight.js';
import { fetchEnvironments, fetchProjects, createEnvironment } from '../env/platform-api.js';
import type { Environment } from '../env/platform-api.js';
import { getDeployEnvFiles, loadDeployEnvFromDotenv, readEnvVars, getMastraVersion } from '../studio/deploy.js';
import { createProject } from '../studio/platform-api.js';
import { getProjectConfigToSave, loadProjectConfig, saveProjectConfig } from '../studio/project-config.js';
import { maybeAutoProvisionDatabases } from './auto-provision-database.js';
import { getOverwrittenEnvKeys } from './env-vars.js';
import { assertDeployDir } from './validate-dir.js';

/**
 * Derive the public studio/server URLs from the environment slug.
 * These are the user-facing URLs, not the internal Railway instanceUrl.
 */
function derivePublicUrls(
  slug: string,
  projectType?: string,
): { studioUrl: string; serverUrl: string; serverLabel: string } {
  // Determine if we're targeting staging or production
  const isStaging = MASTRA_PLATFORM_API_URL.includes('staging');
  const baseDomain = isStaging ? 'staging.mastra.cloud' : 'mastra.cloud';
  const isFactory = projectType === 'factory';
  const serverSubdomain = isFactory ? 'factory' : 'server';

  return {
    studioUrl: `https://${slug}.studio.${baseDomain}`,
    serverUrl: `https://${slug}.${serverSubdomain}.${baseDomain}`,
    serverLabel: isFactory ? 'Factory' : 'Server',
  };
}

function elapsed(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

const workersManifestPath = (targetDir: string): string => join(targetDir, '.mastra', 'output', 'workers.json');

async function hasWorkersManifest(targetDir: string): Promise<boolean> {
  try {
    await access(workersManifestPath(targetDir));
    return true;
  } catch {
    return false;
  }
}

export function deployBuildNeedsRefresh(staleness: { isStale: boolean }, workersManifestExists: boolean): boolean {
  return staleness.isStale || !workersManifestExists;
}

interface WorkerManifestSection {
  enabled: boolean;
  [key: string]: unknown;
}

interface WorkerManifestV1 extends Record<string, unknown> {
  version: 1;
  orchestration: WorkerManifestSection;
  scheduler: WorkerManifestSection;
  backgroundTasks: WorkerManifestSection;
  custom: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWorkerManifestV1(value: Record<string, unknown> | null): value is WorkerManifestV1 {
  return (
    value?.version === 1 &&
    isRecord(value.orchestration) &&
    isRecord(value.scheduler) &&
    isRecord(value.backgroundTasks) &&
    Array.isArray(value.custom) &&
    value.custom.every(name => typeof name === 'string')
  );
}

async function readWorkersConfig(targetDir: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(workersManifestPath(targetDir), 'utf-8');
    const manifest = JSON.parse(raw) as unknown;
    return isRecord(manifest) ? manifest : null;
  } catch {
    return null;
  }
}

export async function hasEnabledWorkers(targetDir: string): Promise<boolean> {
  const manifest = await readWorkersConfig(targetDir);
  if (isWorkerManifestV1(manifest)) {
    return (
      manifest.orchestration.enabled === true ||
      manifest.scheduler.enabled === true ||
      manifest.backgroundTasks.enabled === true ||
      manifest.custom.length > 0
    );
  }
  return manifest?.enabled === true;
}

type ArchitectureColors = ReturnType<typeof pc.createColors>;
type ArchitectureTone = 'blue' | 'cyan' | 'green' | 'gray' | 'magenta' | 'red' | 'yellow';

const UNITED_STATES_DEPLOY_LOCATION = 'United States';
const EUROPE_DEPLOY_LOCATION = 'Europe';

interface ArchitectureNode {
  title: string;
  subtitle: string;
  tone: ArchitectureTone;
}

const BOX_INNER_WIDTH = 30;
const BOX_WIDTH = BOX_INNER_WIDTH + 2;
const BOX_TEXT_WIDTH = BOX_INNER_WIDTH - 2;
const BOX_HEIGHT = 4;
const SLOT_HEIGHT = BOX_HEIGHT + 1;
const CONNECTOR_GAP_WIDTH = 7;
const CONNECTOR_SPINE_X = Math.floor(CONNECTOR_GAP_WIDTH / 2);

const DATABASE_PRESENTATION: Record<ProjectDatabase['kind'], { label: string; tone: ArchitectureTone }> = {
  turso: { label: 'Turso', tone: 'cyan' },
  neon: { label: 'Neon', tone: 'green' },
  mongodb: { label: 'MongoDB', tone: 'green' },
  redis: { label: 'Redis', tone: 'red' },
};

function architectureTextWidth(value: string): number {
  return Array.from(value).length;
}

function truncateArchitectureText(value: string, width = BOX_TEXT_WIDTH): string {
  const characters = Array.from(value);
  if (characters.length <= width) return value;
  return `${characters.slice(0, width - 1).join('')}…`;
}

function isEuropeDeploymentRegion(region: string | null): boolean {
  const normalized = region?.trim().toLowerCase();
  return normalized === 'eu' || normalized === 'ams' || normalized?.startsWith('europe-') === true;
}

function formatDeploymentLocation(region: string | null): string {
  return isEuropeDeploymentRegion(region) ? EUROPE_DEPLOY_LOCATION : UNITED_STATES_DEPLOY_LOCATION;
}

function formatDeploymentRegion(region: string | null): string {
  const normalized = region?.trim().toLowerCase();
  if (!normalized || normalized === 'us' || normalized === 'pdx' || normalized.startsWith('us-west')) {
    return 'US West';
  }
  if (normalized === 'iad' || normalized.startsWith('us-east')) return 'US East';
  if (normalized === 'sfo') return 'US West (SF)';
  if (normalized === 'eu' || normalized === 'ams' || normalized.startsWith('europe-')) return 'EU West';
  return region ?? 'US West';
}

function formatArchitectureDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function paintArchitectureTone(colors: ArchitectureColors, tone: ArchitectureTone, value: string): string {
  switch (tone) {
    case 'blue':
      return colors.blue(value);
    case 'cyan':
      return colors.cyan(value);
    case 'green':
      return colors.green(value);
    case 'gray':
      return colors.gray(value);
    case 'magenta':
      return colors.magenta(value);
    case 'red':
      return colors.red(value);
    case 'yellow':
      return colors.yellow(value);
  }
}

function formatWorkersConfigName(name: string): string {
  return name
    .replace(/Ms$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\bTtl\b/g, 'TTL')
    .replace(/\bUrl\b/g, 'URL')
    .replace(/\bId\b/g, 'ID')
    .replace(/\b\w/g, character => character.toUpperCase());
}

function formatDuration(ms: number): string {
  const units = [
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
    ['second', 1_000],
  ] as const;
  for (const [unit, unitMs] of units) {
    if (ms >= unitMs && ms % unitMs === 0) {
      const amount = ms / unitMs;
      return `${amount} ${unit}${amount === 1 ? '' : 's'}`;
    }
  }
  return `${ms} ms`;
}

function formatWorkersConfigValue(name: string, value: unknown): string {
  if (typeof value === 'number' && name.endsWith('Ms')) return formatDuration(value);
  if (typeof value === 'string') return value.replace(/(^|[-_ ])\w/g, match => match.toUpperCase());
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(item => String(item)).join(', ');
  return String(value);
}

function flattenWorkersConfig(
  config: Record<string, unknown>,
  prefix: string[] = [],
): Array<{ name: string; value: string }> {
  const entries: Array<{ name: string; value: string }> = [];
  for (const [name, value] of Object.entries(config)) {
    if (name === 'enabled') continue;
    if (isRecord(value)) {
      entries.push(...flattenWorkersConfig(value, [...prefix, formatWorkersConfigName(name)]));
      continue;
    }
    entries.push({
      name: [...prefix, formatWorkersConfigName(name)].join(' · '),
      value: formatWorkersConfigValue(name, value),
    });
  }
  return entries;
}

function renderWorkerConfigItem(
  title: string,
  enabled: boolean,
  details: Array<{ name?: string; value: string }>,
  colors: ArchitectureColors,
): string[] {
  const dot = enabled ? colors.green('●') : colors.gray('●');
  const label = enabled ? colors.bold(colors.white(title)) : colors.gray(title);
  const detailColor = enabled ? colors.yellow : colors.gray;
  return [
    `${dot} ${label}`,
    ...details.map(({ name, value }) =>
      name ? `    ${colors.dim(name)}: ${detailColor(value)}` : `    ${detailColor(value)}`,
    ),
  ];
}

function renderVersionedWorkersConfig(manifest: WorkerManifestV1, colors: ArchitectureColors): string[] {
  const customEnabled = manifest.custom.length > 0;
  return [
    ...renderWorkerConfigItem(
      'Orchestration',
      manifest.orchestration.enabled === true,
      flattenWorkersConfig(manifest.orchestration),
      colors,
    ),
    ...renderWorkerConfigItem(
      'Scheduler',
      manifest.scheduler.enabled === true,
      flattenWorkersConfig(manifest.scheduler),
      colors,
    ),
    ...renderWorkerConfigItem(
      'Background Tasks',
      manifest.backgroundTasks.enabled === true,
      flattenWorkersConfig(manifest.backgroundTasks),
      colors,
    ),
    ...renderWorkerConfigItem(
      'Custom',
      customEnabled,
      manifest.custom.map(workerName => ({ value: workerName })),
      colors,
    ),
  ];
}

function renderDeploymentPanel(
  input: {
    projectName: string;
    environment: Pick<Environment, 'name' | 'region'>;
    workersEnabled: boolean;
    workersConfig: Record<string, unknown> | null;
    renderedAt: Date;
  },
  colors: ArchitectureColors,
): string[] {
  const workersConfigLines = isWorkerManifestV1(input.workersConfig)
    ? renderVersionedWorkersConfig(input.workersConfig, colors)
    : input.workersEnabled && input.workersConfig
      ? Object.entries(input.workersConfig)
          .filter(([name]) => name !== 'enabled')
          .map(
            ([name, value]) =>
              `• ${colors.bold(formatWorkersConfigName(name))}: ${colors.yellow(formatWorkersConfigValue(name, value))}`,
          )
      : [`• ${colors.bold('Status')}: ${colors.yellow(input.workersEnabled ? 'Enabled' : 'Disabled')}`];

  return [
    colors.bold(input.projectName),
    colors.bold(`${input.environment.name} (${formatDeploymentRegion(input.environment.region)})`),
    colors.dim(formatArchitectureDate(input.renderedAt)),
    '',
    colors.bold('Workers Config'),
    ...workersConfigLines,
  ];
}

function visibleArchitectureWidth(value: string): number {
  return architectureTextWidth(value.replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, ''));
}

function renderArchitectureBox(node: ArchitectureNode | undefined, colors: ArchitectureColors): string[] {
  if (!node) return Array.from({ length: BOX_HEIGHT }, () => ' '.repeat(BOX_WIDTH));

  const title = truncateArchitectureText(node.title);
  const subtitle = truncateArchitectureText(node.subtitle);
  const border = (value: string) => paintArchitectureTone(colors, node.tone, value);
  return [
    border(`┌${'─'.repeat(BOX_INNER_WIDTH)}┐`),
    `${border('│')} ${colors.bold(title)}${' '.repeat(BOX_TEXT_WIDTH - architectureTextWidth(title))} ${border('│')}`,
    `${border('│')} ${colors.dim(subtitle)}${' '.repeat(BOX_TEXT_WIDTH - architectureTextWidth(subtitle))} ${border('│')}`,
    border(`└${'─'.repeat(BOX_INNER_WIDTH)}┘`),
  ];
}

function connectorJunction(up: boolean, down: boolean, left: boolean, right: boolean): string {
  if (up && down && left && right) return '┼';
  if (up && down && left) return '┤';
  if (up && down && right) return '├';
  if (down && left && right) return '┬';
  if (up && left && right) return '┴';
  if (down && right) return '┌';
  if (down && left) return '┐';
  if (up && right) return '└';
  if (up && left) return '┘';
  if (left || right) return '─';
  return '│';
}

function renderConnectorGap(
  y: number,
  nodeConnectorYs: ReadonlySet<number>,
  centerConnectorY: number,
  side: 'left' | 'right',
  colors: ArchitectureColors,
): string {
  const connectorYs = [...nodeConnectorYs, centerConnectorY];
  const minY = Math.min(...connectorYs);
  const maxY = Math.max(...connectorYs);
  if (y < minY || y > maxY) return ' '.repeat(CONNECTOR_GAP_WIDTH);

  const hasNode = nodeConnectorYs.has(y);
  const left = side === 'left' ? hasNode : y === centerConnectorY;
  const right = side === 'left' ? y === centerConnectorY : hasNode;
  const cells = Array.from({ length: CONNECTOR_GAP_WIDTH }, () => ' ');

  if (left) {
    for (let x = 0; x < CONNECTOR_SPINE_X; x++) cells[x] = '─';
  }
  if (right) {
    for (let x = CONNECTOR_SPINE_X + 1; x < CONNECTOR_GAP_WIDTH; x++) cells[x] = '─';
  }
  cells[CONNECTOR_SPINE_X] = connectorJunction(y > minY, y < maxY, left, right);

  return colors.dim(cells.join(''));
}

export function renderDeploymentArchitecture(
  input: {
    projectName: string;
    environment: Pick<Environment, 'id' | 'name' | 'region'>;
    serverLabel: string;
    workersEnabled: boolean;
    workersConfig: Record<string, unknown> | null;
    databases: readonly ProjectDatabase[];
    observabilityEnabled: boolean;
    renderedAt?: Date;
  },
  colors: ArchitectureColors = pc,
): string {
  const databases = input.databases
    .filter(
      database =>
        database.deletedAt === null &&
        (database.environmentId === null || database.environmentId === input.environment.id) &&
        (database.status === 'ready' || database.status === 'provisioning'),
    )
    .sort((left, right) => left.name.localeCompare(right.name));

  const leftNodes: ArchitectureNode[] = [
    { title: 'Studio', subtitle: 'Project studio', tone: 'blue' },
    {
      title: input.serverLabel,
      subtitle: 'API service',
      tone: input.serverLabel === 'Factory' ? 'yellow' : 'magenta',
    },
    ...(input.workersEnabled ? [{ title: 'Workers', subtitle: 'Worker runtime', tone: 'yellow' as const }] : []),
  ];
  const rightNodes: ArchitectureNode[] = [
    ...databases.map(database => {
      const presentation = DATABASE_PRESENTATION[database.kind];
      return {
        title: database.name,
        subtitle: `${presentation.label} · ${database.status === 'ready' ? 'Connected' : 'Provisioning'}`,
        tone: presentation.tone,
      };
    }),
    ...(input.observabilityEnabled
      ? [{ title: 'Observability', subtitle: 'Mastra Platform', tone: 'green' as const }]
      : []),
  ];

  const slotCount = Math.max(leftNodes.length, rightNodes.length);
  const centerSlot = Math.floor((slotCount - 1) / 2);
  const centerNode: ArchitectureNode = {
    title: input.environment.name,
    subtitle: formatDeploymentLocation(input.environment.region),
    tone: 'gray',
  };
  const connectorLineOffset = 2;
  const centerConnectorY = centerSlot * SLOT_HEIGHT + connectorLineOffset;
  const leftConnectorYs = new Set(leftNodes.map((_, index) => index * SLOT_HEIGHT + connectorLineOffset));
  const rightConnectorYs = new Set(rightNodes.map((_, index) => index * SLOT_HEIGHT + connectorLineOffset));
  const lines: string[] = [];

  for (let slot = 0; slot < slotCount; slot++) {
    const leftBox = renderArchitectureBox(leftNodes[slot], colors);
    const centerBox = renderArchitectureBox(slot === centerSlot ? centerNode : undefined, colors);
    const rightBox = renderArchitectureBox(rightNodes[slot], colors);

    for (let line = 0; line < BOX_HEIGHT; line++) {
      const y = slot * SLOT_HEIGHT + line;
      lines.push(
        `${leftBox[line]}${renderConnectorGap(y, leftConnectorYs, centerConnectorY, 'left', colors)}${centerBox[line]}${renderConnectorGap(y, rightConnectorYs, centerConnectorY, 'right', colors)}${rightBox[line]}`.trimEnd(),
      );
    }

    if (slot < slotCount - 1) {
      const y = slot * SLOT_HEIGHT + BOX_HEIGHT;
      lines.push(
        `${' '.repeat(BOX_WIDTH)}${renderConnectorGap(y, leftConnectorYs, centerConnectorY, 'left', colors)}${' '.repeat(BOX_WIDTH)}${renderConnectorGap(y, rightConnectorYs, centerConnectorY, 'right', colors)}`.trimEnd(),
      );
    }
  }

  const panelLines = renderDeploymentPanel(
    {
      projectName: input.projectName,
      environment: input.environment,
      workersEnabled: input.workersEnabled,
      workersConfig: input.workersConfig,
      renderedAt: input.renderedAt ?? new Date(),
    },
    colors,
  );
  const rowCount = Math.max(lines.length, panelLines.length);
  const panelWidth = Math.max(...panelLines.map(visibleArchitectureWidth));

  return Array.from({ length: rowCount }, (_, index) => {
    const panelLine = panelLines[index] ?? '';
    const paddedPanelLine = `${panelLine}${' '.repeat(Math.max(0, panelWidth - visibleArchitectureWidth(panelLine)))}`;
    return `${paddedPanelLine}  ${colors.dim('│')}  ${lines[index] ?? ''}`.trimEnd();
  }).join('\n');
}

function getPackageName(projectDir: string): string | null {
  try {
    const raw = execSync('node -p "require(\'./package.json\').name"', {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return raw.startsWith('@') ? (raw.split('/')[1] ?? raw) : raw;
  } catch {
    return null;
  }
}

function getGitBranch(projectDir: string): string | null {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

export async function zipOutput(projectDir: string): Promise<string> {
  const outputDir = join(projectDir, '.mastra', 'output');
  const tmpDir = join(tmpdir(), 'mastra-deploy');
  await mkdir(tmpDir, { recursive: true });
  const zipPath = join(tmpDir, `deploy-${Date.now()}.zip`);

  return new Promise((resolvePromise, reject) => {
    const output = createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 6 } });

    output.on('close', () => resolvePromise(zipPath));
    archive.on('error', reject);

    archive.pipe(output);
    // `**` skips dotfiles by default; `dot` keeps the .npmrc that the build
    // copies into the output so private-registry installs work remotely.
    archive.glob('**', { cwd: outputDir, ignore: ['node_modules/**'], dot: true }, { prefix: 'output' });
    void archive.finalize();
  });
}

/* ------------------------------------------------------------------ */
/*  Resolve org                                                       */
/* ------------------------------------------------------------------ */

async function resolveOrg(
  token: string,
  projectConfig: { organizationId?: string } | null,
  flagOrg?: string,
): Promise<{ orgId: string; orgName: string }> {
  const envOrgId = process.env.MASTRA_ORG_ID;
  if (envOrgId) {
    return { orgId: envOrgId, orgName: envOrgId };
  }

  if (flagOrg) {
    const orgs = await fetchOrgs(token);
    const match = orgs.find(o => o.id === flagOrg);
    return { orgId: flagOrg, orgName: match?.name ?? flagOrg };
  }

  if (projectConfig?.organizationId) {
    const orgs = await fetchOrgs(token);
    const match = orgs.find(o => o.id === projectConfig.organizationId);
    if (match) {
      return { orgId: match.id, orgName: match.name };
    }
  }

  const currentOrgId = await getCurrentOrgId();
  const orgs = await fetchOrgs(token);

  if (currentOrgId) {
    const match = orgs.find(o => o.id === currentOrgId);
    if (match) {
      return { orgId: match.id, orgName: match.name };
    }
  }

  if (orgs.length === 1) {
    return { orgId: orgs[0]!.id, orgName: orgs[0]!.name };
  }

  if (orgs.length === 0) {
    throw new Error(`You have no organizations. Please create one at ${MASTRA_STUDIO_URL}`);
  }

  const selected = await p.select({
    message: 'Select an organization',
    options: orgs.map(o => ({ value: o.id, label: `${o.name} (${o.id})` })),
  });

  if (p.isCancel(selected)) {
    p.cancel('Deploy cancelled.');
    process.exit(0);
  }

  const selectedOrg = orgs.find(o => o.id === selected)!;
  return { orgId: selectedOrg.id, orgName: selectedOrg.name };
}

/* ------------------------------------------------------------------ */
/*  Resolve project                                                   */
/* ------------------------------------------------------------------ */

type ProjectResolution =
  | { existing: true; projectId: string; projectName: string; projectSlug: string }
  | { existing: false; projectName: string };

export async function resolveProject(
  token: string,
  orgId: string,
  projectConfig: { projectId?: string; projectName?: string; projectSlug?: string; organizationId?: string } | null,
  flagProject?: string,
  defaultName?: string | null,
  autoAccept?: boolean,
): Promise<ProjectResolution> {
  const envProjectId = process.env.MASTRA_PROJECT_ID;
  if (envProjectId) {
    const projects = await fetchProjects(token, orgId);
    const project = projects.find(candidate => candidate.id === envProjectId);
    return {
      existing: true,
      projectId: envProjectId,
      projectName: project?.name ?? envProjectId,
      projectSlug: project?.slug ?? project?.name ?? envProjectId,
    };
  }

  if (flagProject) {
    const projects = await fetchProjects(token, orgId);
    const byId = projects.find(proj => proj.id === flagProject);
    const bySlug = projects.find(proj => proj.slug === flagProject);
    const byName = projects.filter(proj => proj.name === flagProject);
    if (!byId && !bySlug && byName.length > 1) {
      p.cancel(
        `Multiple projects are named "${flagProject}". Pass --project with the project id or slug to disambiguate.`,
      );
      process.exit(1);
    }
    const match = byId ?? bySlug ?? (byName.length === 1 ? byName[0] : undefined);
    if (match) {
      return { existing: true, projectId: match.id, projectName: match.name, projectSlug: match.slug ?? match.name };
    }
    return { existing: false, projectName: flagProject };
  }

  if (projectConfig?.projectId && projectConfig.organizationId === orgId) {
    return {
      existing: true,
      projectId: projectConfig.projectId,
      projectName: projectConfig.projectName ?? projectConfig.projectId,
      projectSlug: projectConfig.projectSlug ?? projectConfig.projectName ?? projectConfig.projectId,
    };
  }

  const projects = await fetchProjects(token, orgId);
  const nameMatches = defaultName
    ? projects.filter(proj => proj.name === defaultName || proj.slug === defaultName)
    : [];

  if (projects.length > 0) {
    if (autoAccept) {
      if (nameMatches.length === 1) {
        const m = nameMatches[0]!;
        return { existing: true, projectId: m.id, projectName: m.name, projectSlug: m.slug ?? m.name };
      }
      throw new Error(
        `Found ${projects.length} existing project(s) in this organization. Pass --project <id-or-slug> to select one, or re-run without --yes to choose interactively.`,
      );
    }

    const CREATE_NEW = '__create_new__';
    const initialValue = nameMatches.length === 1 ? nameMatches[0]!.id : projects[0]!.id;
    const selected = await p.select({
      message: 'Select a project to deploy to',
      initialValue,
      options: [
        ...projects.map(proj => ({
          value: proj.id,
          label: `${proj.name} (${proj.id})`,
        })),
        { value: CREATE_NEW, label: defaultName ? `＋ Create new project "${defaultName}"` : '＋ Create new project' },
      ],
    });

    if (p.isCancel(selected)) {
      p.cancel('Deploy cancelled.');
      process.exit(0);
    }

    if (selected !== CREATE_NEW) {
      const match = projects.find(proj => proj.id === selected)!;
      return { existing: true, projectId: match.id, projectName: match.name, projectSlug: match.slug ?? match.name };
    }
  }

  const name = defaultName;
  if (!name) {
    throw new Error('Could not determine project name from package.json. Use --project to specify one.');
  }

  return { existing: false, projectName: name };
}

/* ------------------------------------------------------------------ */
/*  Resolve environment                                               */
/* ------------------------------------------------------------------ */

type EnvironmentResolution =
  | { existing: true; environment: Environment }
  | { existing: false; name: string; type: 'production' | 'staging' | 'preview'; region?: string };

export async function resolveEnvironment(
  token: string,
  orgId: string,
  projectId: string,
  envName: string,
  autoAccept: boolean,
  requestedRegion?: string,
): Promise<EnvironmentResolution> {
  const environments = await fetchEnvironments(token, orgId, projectId);

  // Try to find by name (case-insensitive)
  const existing = environments.find(env => env.name.toLowerCase() === envName.toLowerCase());

  if (existing) {
    return { existing: true, environment: existing };
  }

  // Environment doesn't exist - determine type and prepare to create
  const envType =
    envName.toLowerCase() === 'production' ? 'production' : envName.toLowerCase() === 'staging' ? 'staging' : 'preview';

  // Skip the "create it?" prompt for production. A first deploy naturally
  // creates production — the confirmation is noise. Still prompt for
  // non-standard names in case the user made a typo (e.g. `--env prodcution`).
  if (!autoAccept && envType !== 'production') {
    const confirmed = await p.confirm({
      message: `Environment "${envName}" doesn't exist. Create it?`,
      initialValue: true,
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel('Deploy cancelled.');
      process.exit(0);
    }
  }

  let region = requestedRegion;
  if (!region && !autoAccept) {
    const selectedRegion = await p.select({
      message: 'Select a deployment region',
      initialValue: 'us',
      options: [
        { value: 'us', label: 'United States' },
        { value: 'eu', label: 'Europe' },
      ],
    });

    if (p.isCancel(selectedRegion)) {
      p.cancel('Deploy cancelled.');
      process.exit(0);
    }

    region = selectedRegion;
  }

  return { existing: false, name: envName, type: envType, ...(region ? { region } : {}) };
}

/* ------------------------------------------------------------------ */
/*  Upload to environment deploy endpoint                             */
/* ------------------------------------------------------------------ */

async function uploadToEnvironment(
  token: string,
  orgId: string,
  projectId: string,
  environmentId: string,
  zipBuffer: Buffer,
  opts: {
    gitBranch?: string;
    projectName: string;
    envVars?: Record<string, string>;
    mastraVersion?: string;
    disablePlatformObservability?: boolean;
  },
): Promise<{ id: string; uploadUrl: string }> {
  const apiUrl = process.env.MASTRA_PLATFORM_API_URL || 'https://platform.mastra.ai';

  // Create deploy via environment endpoint.
  //
  // The server reads gitBranch / mastraVersion / projectName from the
  // `x-*` headers (see servers/api/src/routes/environments.ts and
  // servers/api/src/routes/studio/deploys.ts) — passing them in the body
  // would silently no-op, which is what broke `mastraVersion` flowing
  // through to the route entry and the studio asset build.
  const createHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-organization-id': orgId,
    'x-project-name': opts.projectName,
  };
  if (opts.gitBranch) createHeaders['x-git-branch'] = opts.gitBranch;
  if (opts.mastraVersion) createHeaders['x-mastra-version'] = opts.mastraVersion;

  const createBody: Record<string, unknown> = {};
  if (opts.envVars) createBody.envVars = opts.envVars;
  if (opts.disablePlatformObservability !== undefined) {
    createBody.disablePlatformObservability = opts.disablePlatformObservability;
  }

  const createResp = await fetch(`${apiUrl}/v1/projects/${projectId}/environments/${environmentId}/deploy`, {
    method: 'POST',
    headers: createHeaders,
    body: JSON.stringify(createBody),
  });

  if (!createResp.ok) {
    const err = await createResp.json().catch(() => ({}));
    throw new Error(`Failed to create deploy: ${(err as { detail?: string }).detail || createResp.statusText}`);
  }

  const { deploy } = (await createResp.json()) as { deploy: { id: string; uploadUrl: string } };

  // Upload artifact
  const uploadResp = await fetch(deploy.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/zip',
    },
    body: zipBuffer,
  });

  if (!uploadResp.ok) {
    throw new Error(`Failed to upload artifact: ${uploadResp.statusText}`);
  }

  // Signal upload complete — uses net-new env-scoped endpoint so the
  // unified-runtime CLI never touches /v1/studio/*.
  const completeResp = await fetch(
    `${apiUrl}/v1/projects/${projectId}/environments/${environmentId}/deploys/${deploy.id}/upload-complete`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-organization-id': orgId,
      },
    },
  );

  if (!completeResp.ok) {
    const err = await completeResp.json().catch(() => ({}));
    throw new Error(`Failed to complete upload: ${(err as { detail?: string }).detail || completeResp.statusText}`);
  }

  return deploy;
}

interface UnifiedDeployStatus {
  id: string;
  status: string;
  instanceUrl: string | null;
  error: string | null;
}

/**
 * Poll the net-new env-scoped status endpoint until the deploy reaches a
 * terminal state. Kept inside the deploy command so the unified runtime
 * never reaches into ../studio/ for transport.
 */
async function streamEnvironmentDeployLogs(
  token: string,
  orgId: string,
  projectId: string,
  environmentId: string,
  deployId: string,
  signal: AbortSignal,
): Promise<void> {
  // Small delay to let the deploy pipeline start before requesting logs
  await new Promise(r => setTimeout(r, 2000));
  if (signal.aborted) return;

  const apiUrl = process.env.MASTRA_PLATFORM_API_URL || 'https://platform.mastra.ai';
  const url = `${apiUrl}/v1/projects/${projectId}/environments/${environmentId}/deploys/${deployId}/logs/stream`;

  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-organization-id': orgId,
      Accept: 'text/event-stream',
    },
    signal,
  });

  if (!resp.ok || !resp.body) return;

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let skipNextUrlMeta = false;

  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      // Filter internal server startup logs — public URL is shown by CLI after deploy
      if (data.includes('Mastra API running') || data.includes('Studio available')) {
        skipNextUrlMeta = true;
        continue;
      }
      if (skipNextUrlMeta) {
        skipNextUrlMeta = false;
        if (/^(\x1b\[\d+m)*url(\x1b\[\d+m)*:/.test(data)) continue;
      }
      await writeBarLine(data);
    }
  }
}

async function pollEnvironmentDeploy(
  token: string,
  orgId: string,
  projectId: string,
  environmentId: string,
  deployId: string,
  maxWaitMs = 600_000,
): Promise<UnifiedDeployStatus> {
  const apiUrl = process.env.MASTRA_PLATFORM_API_URL || 'https://platform.mastra.ai';
  const url = `${apiUrl}/v1/projects/${projectId}/environments/${environmentId}/deploys/${deployId}`;
  const start = Date.now();
  let currentToken = token;

  // Stream logs in parallel with status polling
  const logAbort = new AbortController();
  streamEnvironmentDeployLogs(currentToken, orgId, projectId, environmentId, deployId, logAbort.signal).catch(() => {});

  try {
    while (Date.now() - start < maxWaitMs) {
      const resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${currentToken}`,
          'x-organization-id': orgId,
        },
      });

      if (resp.status === 401) {
        currentToken = await getToken();
        // Back off before retrying so a persistently-401 token cannot spin
        // the poll loop into a tight retry storm against the platform API.
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      if (!resp.ok) {
        const err = (await resp.json().catch(() => ({}))) as { detail?: string };
        throw new Error(`Poll failed: ${err.detail || resp.statusText}`);
      }

      const { deploy } = (await resp.json()) as { deploy: UnifiedDeployStatus };

      if (deploy.status === 'running' || deploy.status === 'failed' || deploy.status === 'stopped') {
        return deploy;
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    throw new Error('Deploy timed out');
  } finally {
    logAbort.abort();
  }
}

/* ------------------------------------------------------------------ */
/*  Main unified deploy action                                        */
/* ------------------------------------------------------------------ */

export interface DeployOptions {
  env?: string;
  org?: string;
  project?: string;
  yes?: boolean;
  config?: string;
  skipBuild?: boolean;
  skipPreflight?: boolean;
  region?: string;
  debug?: boolean;
  envFile?: string;
}

export async function unifiedDeployAction(dir: string | undefined, opts: DeployOptions) {
  const analytics = getAnalytics();
  if (!analytics) {
    return runUnifiedDeploy(dir, opts);
  }
  return analytics.trackCommandExecution({
    command: 'mastra deploy',
    args: {
      env: opts.env || 'production',
      yes: Boolean(opts.yes),
      skipBuild: Boolean(opts.skipBuild),
      skipPreflight: Boolean(opts.skipPreflight),
      hasOrg: Boolean(opts.org),
      hasProject: Boolean(opts.project),
      hasEnvFile: Boolean(opts.envFile),
      hasConfig: Boolean(opts.config),
      debug: Boolean(opts.debug),
      headless: Boolean(process.env.MASTRA_API_TOKEN),
      targetApi: bucketApiHost(MASTRA_PLATFORM_API_URL),
    },
    execution: () => runUnifiedDeploy(dir, opts),
    origin: process.env.MASTRA_ANALYTICS_ORIGIN as CLI_ORIGIN | undefined,
  });
}

async function runUnifiedDeploy(dir: string | undefined, opts: DeployOptions) {
  const targetDir = resolve(dir || process.cwd());
  await assertDeployDir(dir, targetDir);
  loadDeployEnvFromDotenv(targetDir);

  const isHeadless = Boolean(process.env.MASTRA_API_TOKEN);
  if (isHeadless && (!process.env.MASTRA_ORG_ID || !process.env.MASTRA_PROJECT_ID)) {
    throw new Error('MASTRA_ORG_ID and MASTRA_PROJECT_ID are required when MASTRA_API_TOKEN is set');
  }

  const autoAccept = opts.yes ?? isHeadless;
  const skipPreflight = opts.skipPreflight || process.env.MASTRA_SKIP_PREFLIGHT === '1';
  const envName = opts.env || 'production';

  p.intro(`${pc.bold('mastra deploy')} → ${pc.cyan(envName)}`);

  // Gather context
  const packageName = getPackageName(targetDir);
  const gitBranch = getGitBranch(targetDir);
  const mastraVersion = getMastraVersion(targetDir);

  // Step 1: Auth
  const token = await getToken();

  // Step 2: Load existing project config
  const projectConfig = await loadProjectConfig(targetDir, opts.config);

  // Step 3: Resolve org
  const { orgId, orgName } = await resolveOrg(token, projectConfig, opts.org);

  // Step 4: Resolve project (does NOT create yet)
  const resolution = await resolveProject(token, orgId, projectConfig, opts.project, packageName, autoAccept);

  let projectId: string;
  let projectName: string;
  let projectSlug: string;

  if (resolution.existing) {
    projectId = resolution.projectId;
    projectName = resolution.projectName;
    projectSlug = resolution.projectSlug;
  } else {
    projectName = resolution.projectName;

    p.note(
      [
        `Organization:  ${orgName}`,
        `Project:       ${projectName} (new)`,
        `Environment:   ${envName}`,
        `Directory:     ${targetDir}`,
        ...(gitBranch ? [`Git branch:    ${gitBranch}`] : []),
        ...(mastraVersion ? [`Mastra:        ${mastraVersion}`] : []),
      ].join('\n'),
      'Deploy settings',
    );

    if (!autoAccept) {
      const confirmed = await p.confirm({
        message: 'Create project and deploy?',
      });

      if (p.isCancel(confirmed) || !confirmed) {
        p.cancel('Deploy cancelled.');
        process.exit(0);
      }
    }

    // Create the project
    const project = await createProject(token, orgId, projectName);
    projectId = project.id;
    projectSlug = project.slug ?? project.name;
    p.log.success(`Created project "${projectName}"`);

    // Save the project link
    await saveProjectConfig(
      targetDir,
      getProjectConfigToSave(projectId, projectName, projectSlug, orgId, projectConfig),
      opts.config,
    );
    p.log.success(`Saved ${opts.config || '.mastra-project.json'}`);
  }

  // Step 5: Resolve environment (auto-create production if first deploy)
  const envResolution = await resolveEnvironment(token, orgId, projectId, envName, autoAccept, opts.region);

  let environment: Environment;

  if (envResolution.existing) {
    environment = envResolution.environment;
  } else {
    // Create the environment
    environment = await createEnvironment(token, orgId, projectId, {
      name: envResolution.name,
      type: envResolution.type,
      ...(envResolution.region ? { region: envResolution.region } : {}),
    });
    p.log.success(`Created ${envResolution.type} environment "${envResolution.name}"`);
  }

  // Show confirmation for existing project
  if (resolution.existing) {
    const isAlreadyLinked =
      projectConfig?.projectId === projectId &&
      projectConfig.organizationId === orgId &&
      projectConfig.projectName === projectName &&
      projectConfig.projectSlug === projectSlug;

    p.note(
      [
        `Organization:  ${orgName}`,
        `Project:       ${projectName}`,
        `Environment:   ${environment.name} (${environment.slug})`,
        `Directory:     ${targetDir}`,
        ...(gitBranch ? [`Git branch:    ${gitBranch}`] : []),
        ...(mastraVersion ? [`Mastra:        ${mastraVersion}`] : []),
      ].join('\n'),
      'Deploy settings',
    );

    if (!autoAccept) {
      const confirmed = await p.confirm({
        message: 'Deploy with these settings?',
      });

      if (p.isCancel(confirmed) || !confirmed) {
        p.cancel('Deploy cancelled.');
        process.exit(0);
      }
    }

    if (!isAlreadyLinked) {
      await saveProjectConfig(
        targetDir,
        getProjectConfigToSave(projectId, projectName, projectSlug, orgId, projectConfig),
        opts.config,
      );
      p.log.success(`Saved ${opts.config || '.mastra-project.json'}`);
    }
  }

  // Step 6: Build + Zip + Upload + Poll
  const s = p.spinner();
  const tTotal = performance.now();

  let t: number;

  // Check build staleness
  const mastraDir = join(targetDir, 'src', 'mastra');
  const outputDirectory = join(targetDir, '.mastra');
  // Detect project type so staleness hashing includes Factory UI inputs
  const mastraEntryFile = findMastraEntryFile(mastraDir);
  let projectType: string | undefined;
  if (mastraEntryFile) {
    projectType = await analyzeEntryProjectType(mastraEntryFile);
  }
  const staleness = await checkBuildStaleness(targetDir, mastraDir, outputDirectory, projectType);
  const workersManifestExists = await hasWorkersManifest(targetDir);
  const buildNeedsRefresh = deployBuildNeedsRefresh(staleness, workersManifestExists);

  if (opts.skipBuild) {
    if (staleness.isStale && staleness.reason !== 'no-build') {
      if (staleness.reason === 'hash-mismatch') {
        p.log.warn('Source files have changed since last build. Deploy may not reflect latest changes.');
      } else if (staleness.reason === 'no-manifest') {
        p.log.warn('No build manifest found. Cannot verify if build is up-to-date.');
      }
    }
    p.log.step('Skipping build (--skip-build)');
  } else if (buildNeedsRefresh) {
    t = performance.now();
    if (staleness.reason === 'hash-mismatch') {
      p.log.step('Source files changed, rebuilding...');
    } else if (!workersManifestExists) {
      p.log.step('Build metadata is outdated, rebuilding...');
    }
    await runBuild(targetDir, { debug: opts.debug });
    p.log.step(`Build completed (${elapsed(performance.now() - t)})`);
  } else {
    p.log.step('Build is up-to-date, skipping rebuild');
  }

  // Verify build output exists
  const outputEntry = join(targetDir, '.mastra', 'output', 'index.mjs');
  try {
    await access(outputEntry);
  } catch {
    throw new Error('.mastra/output/index.mjs not found — did the build succeed?');
  }

  // Auto-select .env.<envName> when deploying to a named environment
  // (e.g. --env staging auto-selects .env.staging if it exists).
  //
  // envName comes from the --env CLI flag, so we validate it before
  // interpolating it into a file path. Only simple environment identifiers
  // (letters, digits, dot, dash, underscore) are allowed; anything with a
  // path separator or `..` traversal segment is ignored. This keeps a
  // hostile --env value from escaping the project directory and being read
  // (and re-uploaded) via readEnvVars.
  let envFile = opts.envFile;
  if (!envFile && /^[a-zA-Z0-9._-]+$/.test(envName) && !envName.includes('..')) {
    const envNameFile = `.env.${envName}`;
    const candidate = resolve(targetDir, envNameFile);
    const targetPrefix = resolve(targetDir) + '/';
    if (candidate.startsWith(targetPrefix)) {
      try {
        await access(candidate);
        envFile = envNameFile;
      } catch {
        // No matching env file for this environment name — fall through to default logic
      }
    }
  }

  // If the user didn't pass --env-file and no ambient .env* file exists,
  // skip the local env-var upload entirely and let the platform use the
  // env vars stored on the target environment. The server-side deploy
  // handler merges request envVars over environment.envVars, so an empty
  // (absent) envVars payload cleanly falls back to what's already stored.
  let envVars: Record<string, string> = {};
  const hasAmbientEnvFile = envFile ? true : (await getDeployEnvFiles(targetDir)).length > 0;
  if (hasAmbientEnvFile) {
    envVars = await readEnvVars(targetDir, { autoAccept, envFile });
  }
  const envCount = Object.keys(envVars).length;
  if (envCount > 0) {
    p.log.step(`Found ${envCount} env var(s)`);
  } else if (hasAmbientEnvFile) {
    p.log.step('No env vars found in selected env file');
  } else {
    p.log.step('No local env file — using env vars stored on the environment');
  }

  // Warn before overwriting env vars that already exist on the environment
  // with a different value. The platform merges request envVars over the
  // stored environment.envVars (request wins), so these keys get replaced.
  // Only relevant when deploying to a pre-existing environment.
  if (envCount > 0 && envResolution.existing) {
    const overwrittenKeys = getOverwrittenEnvKeys(environment.envVars, envVars);
    if (overwrittenKeys.length > 0) {
      p.log.warn(
        `This deploy will overwrite ${overwrittenKeys.length} existing env var(s) on "${environment.name}":\n` +
          overwrittenKeys.map(key => `  • ${key}`).join('\n'),
      );

      if (!autoAccept) {
        const confirmed = await p.confirm({
          message: 'Overwrite these env vars?',
          initialValue: true,
        });

        if (p.isCancel(confirmed) || !confirmed) {
          p.cancel('Deploy cancelled.');
          process.exit(0);
        }
      }
    }
  }

  // Pre-upload validation. Preflight sees the same env picture the platform
  // applies at deploy time: request env vars merged over the environment's
  // stored vars (request wins), so platform-stored vars don't false-alarm.
  if (!skipPreflight) {
    const preflightEnv = mergePreflightEnvVars(environment.envVars, envVars);
    let issues = await preflightBuildOutput(targetDir, preflightEnv, {
      hasEnvFile: hasAmbientEnvFile,
      // Managed resources (e.g. attached databases) inject vars at deploy
      // time; the platform exposes their names on the environment. Absent
      // field = older platform = incomplete env picture (soften to warnings).
      managedEnvVarNames: environment.managedEnvVarNames ?? null,
      // Use the environment NAME (e.g. `production`, `staging`), not the
      // slug: some platforms derive the production env's slug from the
      // project name (`my-app-xyz-1234`), which the env-resolver accepts
      // but is jarring in a printed remediation command. The name is what
      // the user actually types.
      environmentName: environment.name,
    });

    // If preflight flagged a blocking issue that a managed database would
    // fix (e.g. TURSO_DATABASE_URL missing), offer to attach one inline
    // rather than failing the deploy and asking the user to run
    // `mastra env db create` themselves.
    const autoProvisioned = await maybeAutoProvisionDatabases(issues, {
      token,
      orgId,
      projectId,
      projectName,
      projectSlug,
      environment: {
        id: environment.id,
        slug: environment.slug,
        name: environment.name,
        type: environment.type,
      },
      autoAccept,
    });
    if (autoProvisioned.provisioned.length > 0) {
      const attached = autoProvisioned.provisioned.map(d => `${d.name} (${d.kind})`).join(', ');
      p.log.success(`Attached managed database: ${attached}`);

      // Re-run preflight with the newly-attached vars folded into the
      // managed set. Without this, MISSING_ENV_VAR issues for the vars we
      // just provisioned (TURSO_AUTH_TOKEN, TURSO_DATABASE_URL) still show
      // as "not in the env file being deployed" — misleading right after
      // we told the user the DB was attached. Merging is enough; no need
      // to re-fetch the environment because attachDatabase's response is
      // authoritative for the vars it just injected.
      const mergedManagedNames = [
        ...(environment.managedEnvVarNames ?? []),
        ...autoProvisioned.newlyManagedEnvVarNames,
      ];
      issues = await preflightBuildOutput(targetDir, preflightEnv, {
        hasEnvFile: hasAmbientEnvFile,
        managedEnvVarNames: mergedManagedNames,
        environmentName: environment.name,
      });
    } else {
      issues = autoProvisioned.issues;
    }

    const outcome = await printPreflightIssues(issues, { autoAccept });
    if (outcome === 'blocked') {
      p.cancel('Deploy blocked by preflight errors.');
      process.exit(1);
    }
    if (outcome === 'cancelled') {
      p.cancel('Deploy cancelled.');
      process.exit(0);
    }
  }

  const workersConfig = await readWorkersConfig(targetDir);
  const workersEnabled = workersConfig?.enabled === true;
  const publicUrls = derivePublicUrls(environment.slug, projectType);
  let databases: ProjectDatabase[] = [];
  try {
    databases = await fetchDatabases(token, orgId, projectId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    p.log.warn(`Could not load attached databases for the deployment architecture (${message}).`);
  }
  p.note(
    renderDeploymentArchitecture({
      projectName,
      environment,
      serverLabel: publicUrls.serverLabel,
      workersEnabled,
      workersConfig,
      databases,
      observabilityEnabled: projectConfig?.disablePlatformObservability !== true,
    }),
    'Deployment Overview',
  );

  t = performance.now();
  s.start('Zipping build artifact...');
  const zipPath = await zipOutput(targetDir);
  const zipStat = await stat(zipPath);
  const sizeKB = zipStat.size / 1024;
  const sizeLabel = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)}MB` : `${sizeKB.toFixed(1)}KB`;
  s.stop(`Created ${sizeLabel} archive (${elapsed(performance.now() - t)})`);

  t = performance.now();
  s.start('Uploading...');
  const zipBuffer = await readFile(zipPath);
  const deployResult = await uploadToEnvironment(token, orgId, projectId, environment.id, zipBuffer, {
    gitBranch: gitBranch ?? undefined,
    projectName,
    envVars: envCount > 0 ? envVars : undefined,
    mastraVersion: mastraVersion ?? undefined,
    disablePlatformObservability: projectConfig?.disablePlatformObservability === true,
  });
  s.stop(`Uploaded (${elapsed(performance.now() - t)})`);

  await rm(zipPath, { force: true });

  p.log.step('Waiting for deploy to finish...');
  const finalStatus = await pollEnvironmentDeploy(token, orgId, projectId, environment.id, deployResult.id);

  if (finalStatus.status === 'running') {
    p.log.info(`  Studio: ${pc.cyan(publicUrls.studioUrl)}`);
    p.log.info(`  ${publicUrls.serverLabel}: ${pc.cyan(publicUrls.serverUrl)}`);
    p.outro(`Deploy succeeded in ${elapsed(performance.now() - tTotal)}!`);
  } else if (finalStatus.status === 'failed') {
    p.log.error(`Deploy failed: ${finalStatus.error}`);
    process.exit(1);
  } else {
    p.log.warning(`Deploy ended with status: ${finalStatus.status}`);
    process.exit(1);
  }
}
