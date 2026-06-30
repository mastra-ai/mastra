import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';
import { slash } from '../utils';

/**
 * A file-system routed agent directory discovered under `<mastraDir>/agents/`.
 * All paths are absolute and slash-normalized so they can be embedded into
 * generated module source on any platform.
 */
export interface DiscoveredFsAgent {
  /** Agent directory name. Used as the default `id`/`name`. */
  name: string;
  /** Absolute, slash-normalized path to the agent directory. */
  dir: string;
  /** Absolute path to `config.ts`/`config.js`, if present. */
  configPath?: string;
  /** Absolute path to `instructions.md`, if present. */
  instructionsPath?: string;
  /** Absolute path to `workspace.ts`/`workspace.js`, if present. */
  workspacePath?: string;
  /** Absolute path to `memory.ts`/`memory.js`, if present. */
  memoryPath?: string;
  /**
   * Absolute, slash-normalized path to an authored `workspace/` directory of
   * seed files, if present. These are mirrored into the deployed workspace at
   * build time (Eve parity) so the agent starts with them on disk.
   */
  workspaceSeedDir?: string;
  /** Tools discovered under `tools/`, in stable (sorted) order. */
  tools: { key: string; path: string }[];
  /** Skills discovered under `skills/`, in stable (sorted) order. */
  skills: DiscoveredFsSkill[];
  /**
   * Declared subagents discovered under `subagents/`, in stable (sorted) order.
   * Subagents are one level deep only: a discovered subagent never carries its
   * own `subagents` (nested `subagents/` directories are ignored with a warning).
   */
  subagents: DiscoveredFsAgent[];
}

/**
 * A skill discovered under `agents/<name>/skills/`.
 *
 * - `kind: 'module'` — a `.ts`/`.js` file whose default export is a `createSkill(...)`
 *   result. Codegen imports it directly; `name`/`description`/`instructions` are
 *   unknown at discovery time and resolved at runtime from the module.
 * - `kind: 'packaged'` — a `SKILL.md` (optionally with a `references/` subdir) or a
 *   flat `<skill>.md`. Codegen inlines it via `createSkill(...)` using the parsed
 *   fields below so the deployed bundle carries no filesystem dependency.
 */
export type DiscoveredFsSkill =
  | {
      kind: 'module';
      /** Absolute, slash-normalized path to the `.ts`/`.js` skill module. */
      path: string;
    }
  | {
      kind: 'packaged';
      name: string;
      description: string;
      instructions: string;
      /** Reference file contents keyed by relative path (from `references/`). */
      references: Record<string, string>;
    };

const CONFIG_BASENAMES = ['config.ts', 'config.js'];
const WORKSPACE_BASENAMES = ['workspace.ts', 'workspace.js'];
const MEMORY_BASENAMES = ['memory.ts', 'memory.js'];
const INSTRUCTIONS_BASENAME = 'instructions.md';
const TOOL_EXTENSIONS = ['.ts', '.js'];
const SKILL_MODULE_EXTENSIONS = ['.ts', '.js'];
const SKILL_MD_BASENAME = 'SKILL.md';

/**
 * Presence check that does NOT follow symlinks. Returns `false` for symlinks
 * (and broken links) so a symlinked `config.ts`/`instructions.md`/`workspace.ts`/
 * `memory.ts` is never inlined or imported into the generated bundle.
 */
async function exists(path: string): Promise<boolean> {
  try {
    return !(await lstat(path)).isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Returns the slash-normalized path when `path` is a real directory (not a
 * symlink). Symlinked directories are rejected to prevent the build from
 * following links out of the project tree during discovery.
 */
async function realDirectory(path: string): Promise<string | undefined> {
  try {
    const info = await lstat(path);
    if (info.isDirectory() && !info.isSymbolicLink()) {
      return slash(path);
    }
  } catch {
    // not present
  }
  return undefined;
}

async function directoryExists(path: string): Promise<string | undefined> {
  return realDirectory(path);
}

async function firstExisting(dir: string, basenames: string[]): Promise<string | undefined> {
  for (const basename of basenames) {
    const candidate = join(dir, basename);
    if (await exists(candidate)) {
      return slash(candidate);
    }
  }
  return undefined;
}

function isTestFile(basename: string): boolean {
  return /\.(test|spec)\.(ts|js)$/.test(basename);
}

function toolKey(basename: string): string {
  return basename.replace(/\.(ts|js)$/, '');
}

async function discoverTools(toolsDir: string): Promise<DiscoveredFsAgent['tools']> {
  if (!(await exists(toolsDir))) {
    return [];
  }

  let entries: string[];
  try {
    entries = await readdir(toolsDir);
  } catch {
    return [];
  }

  const tools: DiscoveredFsAgent['tools'] = [];
  for (const basename of entries.sort()) {
    if (isTestFile(basename)) {
      continue;
    }
    if (!TOOL_EXTENSIONS.some(ext => basename.endsWith(ext))) {
      continue;
    }
    const path = join(toolsDir, basename);
    // Use lstat so symlinks are detected (not followed). Skip symlinks and
    // directories: a symlinked tool file could point anywhere on the build
    // machine and be embedded into generated import code.
    const stats = await lstat(path);
    if (stats.isSymbolicLink() || stats.isDirectory()) {
      continue;
    }
    tools.push({ key: toolKey(basename), path: slash(path) });
  }

  return tools;
}

async function readReferences(referencesDir: string): Promise<Record<string, string>> {
  if (!(await exists(referencesDir))) {
    return {};
  }
  const references: Record<string, string> = {};
  let entries: string[];
  try {
    entries = await readdir(referencesDir);
  } catch {
    return {};
  }
  for (const basename of entries.sort()) {
    const path = join(referencesDir, basename);
    // Use lstat so symlinks are detected (not followed). Skip symlinks: a
    // symlink under `references/` could point anywhere on the build machine and
    // silently embed arbitrary file contents into the generated bundle.
    const stats = await lstat(path);
    if (stats.isSymbolicLink() || stats.isDirectory()) {
      continue;
    }
    references[basename] = await readFile(path, 'utf-8');
  }
  return references;
}

async function parsePackagedSkill(
  skillMdPath: string,
  fallbackName: string,
  references: Record<string, string> = {},
): Promise<Extract<DiscoveredFsSkill, { kind: 'packaged' }>> {
  const raw = await readFile(skillMdPath, 'utf-8');
  const parsed = matter(raw);
  const frontmatter = parsed.data as { name?: string; description?: string };
  const name = frontmatter.name ?? fallbackName;
  const description = frontmatter.description ?? '';
  const instructions = parsed.content.trim();
  return { kind: 'packaged', name, description, instructions, references };
}

function skillModuleName(basename: string): string {
  return basename.replace(/\.(ts|js)$/, '');
}

async function discoverSkills(skillsDir: string): Promise<DiscoveredFsSkill[]> {
  if (!(await exists(skillsDir))) {
    return [];
  }

  let entries: string[];
  try {
    entries = await readdir(skillsDir);
  } catch {
    return [];
  }

  const skills: DiscoveredFsSkill[] = [];
  for (const basename of entries.sort()) {
    if (isTestFile(basename)) {
      continue;
    }
    const path = join(skillsDir, basename);
    // Use lstat so symlinks are detected (not followed). Skip symlinks: a
    // symlinked skill module/markdown could point anywhere on the build machine
    // and be bundled or inlined into the generated output.
    const stats = await lstat(path);
    if (stats.isSymbolicLink()) {
      continue;
    }
    const isDir = stats.isDirectory();

    // Packaged skill directory: <skill>/SKILL.md (+ references/)
    if (isDir) {
      const skillMd = join(path, SKILL_MD_BASENAME);
      if (await exists(skillMd)) {
        const references = await readReferences(join(path, 'references'));
        skills.push(await parsePackagedSkill(skillMd, skillModuleName(basename), references));
      }
      continue;
    }

    // createSkill module: <skill>.ts | <skill>.js
    if (SKILL_MODULE_EXTENSIONS.some(ext => basename.endsWith(ext))) {
      skills.push({ kind: 'module', path: slash(path) });
      continue;
    }

    // Flat markdown skill: <skill>.md
    if (basename.endsWith('.md')) {
      const skill = await parsePackagedSkill(path, basename.replace(/\.md$/, ''));
      skills.push(skill);
    }
  }

  return skills;
}

/**
 * Discover a single agent directory: its `config`/`instructions`/`workspace`
 * files plus `tools/`, `skills/`, and (when `allowSubagents`) one level of
 * declared `subagents/`. Returns `undefined` when `dir` is not an agent
 * directory (no `config.(ts|js)` and no `instructions.md`).
 *
 * `allowSubagents` is `true` for top-level agents and `false` when discovering a
 * subagent, so nested `subagents/` directories are never recursed into.
 */
async function discoverAgentDir(
  dir: string,
  name: string,
  allowSubagents: boolean,
  onWarn?: (message: string) => void,
): Promise<DiscoveredFsAgent | undefined> {
  const configPath = await firstExisting(dir, CONFIG_BASENAMES);
  const instructionsPath = (await exists(join(dir, INSTRUCTIONS_BASENAME)))
    ? slash(join(dir, INSTRUCTIONS_BASENAME))
    : undefined;

  // Not an agent directory unless it has a config or instructions file.
  if (!configPath && !instructionsPath) {
    return undefined;
  }

  const workspacePath = await firstExisting(dir, WORKSPACE_BASENAMES);
  const memoryPath = await firstExisting(dir, MEMORY_BASENAMES);
  const workspaceSeedDir = await directoryExists(join(dir, 'workspace'));
  const tools = await discoverTools(join(dir, 'tools'));
  const skills = await discoverSkills(join(dir, 'skills'));
  const subagents = await discoverSubagents(dir, allowSubagents, onWarn);

  return {
    name,
    dir: slash(dir),
    configPath,
    instructionsPath,
    workspacePath,
    memoryPath,
    workspaceSeedDir,
    tools,
    skills,
    subagents,
  };
}

/**
 * Discover declared subagents under `<dir>/subagents/*`. Subagents are one level
 * deep only: each discovered subagent is scanned with `allowSubagents: false`,
 * so a nested `subagents/` directory inside a subagent is ignored with a warning.
 * When `allowSubagents` is `false` (we are already inside a subagent) the whole
 * `subagents/` directory is skipped and a warning is emitted if present.
 */
async function discoverSubagents(
  parentDir: string,
  allowSubagents: boolean,
  onWarn?: (message: string) => void,
): Promise<DiscoveredFsAgent[]> {
  const subagentsDir = join(parentDir, 'subagents');
  if (!(await exists(subagentsDir))) {
    return [];
  }

  if (!allowSubagents) {
    onWarn?.(
      `Ignoring nested subagents in "${slash(subagentsDir)}": subagents are one level deep only, so a subagent cannot declare its own subagents.`,
    );
    return [];
  }

  let entries: string[];
  try {
    entries = await readdir(subagentsDir);
  } catch {
    return [];
  }

  const subagents: DiscoveredFsAgent[] = [];
  for (const name of entries.sort()) {
    const dir = join(subagentsDir, name);
    if (!(await realDirectory(dir))) {
      continue;
    }
    const child = await discoverAgentDir(dir, name, false, onWarn);
    if (child) {
      subagents.push(child);
    }
  }

  return subagents;
}

/**
 * Scan `<mastraDir>/agents/*` for file-system routed agents. A directory is
 * treated as an agent only when it contains a `config.(ts|js)` or an
 * `instructions.md`; other directories are ignored. Each top-level agent may
 * declare one level of `subagents/`. Returns descriptors with absolute,
 * slash-normalized paths ready for codegen. Performs no module evaluation —
 * only filesystem inspection.
 */
export async function discoverFsAgents(
  mastraDir: string,
  onWarn?: (message: string) => void,
): Promise<DiscoveredFsAgent[]> {
  const agentsDir = join(mastraDir, 'agents');
  if (!(await exists(agentsDir))) {
    return [];
  }

  let entries: string[];
  try {
    entries = await readdir(agentsDir);
  } catch {
    return [];
  }

  const discovered: DiscoveredFsAgent[] = [];
  for (const name of entries.sort()) {
    const dir = join(agentsDir, name);
    if (!(await realDirectory(dir))) {
      continue;
    }
    const agent = await discoverAgentDir(dir, name, true, onWarn);
    if (agent) {
      discovered.push(agent);
    }
  }

  return discovered;
}
