import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MAX_FS_SUBAGENT_DEPTH } from '@mastra/core/agent';
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
  /** Input processors discovered under `processors/input/`, in stable (sorted) order. */
  inputProcessors: { key: string; path: string }[];
  /** Output processors discovered under `processors/output/`, in stable (sorted) order. */
  outputProcessors: { key: string; path: string }[];
  /** Skills discovered under `skills/`, in stable (sorted) order. */
  skills: DiscoveredFsSkill[];
  /**
   * Declared subagents discovered under `subagents/`, in stable (sorted) order.
   * Subagents may declare their own `subagents/`, up to `MAX_FS_SUBAGENT_DEPTH`
   * levels below the top-level agent; deeper `subagents/` directories are
   * ignored with a warning.
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

async function discoverProcessors(
  processorsDir: string,
): Promise<{ input: { key: string; path: string }[]; output: { key: string; path: string }[] }> {
  const result = { input: [] as { key: string; path: string }[], output: [] as { key: string; path: string }[] };

  for (const type of ['input', 'output'] as const) {
    const typeDir = join(processorsDir, type);
    if (!(await exists(typeDir))) {
      continue;
    }

    let entries: string[];
    try {
      entries = await readdir(typeDir);
    } catch {
      continue;
    }

    for (const basename of entries.sort()) {
      if (isTestFile(basename)) {
        continue;
      }
      if (!TOOL_EXTENSIONS.some(ext => basename.endsWith(ext))) {
        continue;
      }
      const path = join(typeDir, basename);
      const stats = await lstat(path);
      if (stats.isSymbolicLink() || stats.isDirectory()) {
        continue;
      }
      result[type].push({ key: toolKey(basename), path: slash(path) });
    }
  }

  return result;
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
  const description = frontmatter.description;

  if (!description) {
    throw new Error(
      `Skill "${name}" in ${skillMdPath} is missing a required "description". ` +
        `Add a YAML frontmatter block with a "description:" field. ` +
        `See https://agentskills.io/specification for the SKILL.md format.`,
    );
  }

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
 * files plus `tools/`, `skills/`, and declared `subagents/`. Returns
 * `undefined` when `dir` is not an agent directory (no `config.(ts|js)` and no
 * `instructions.md`).
 *
 * `depth` is the subagent nesting level (`0` for top-level agents). Discovery
 * recurses into `subagents/` until `MAX_FS_SUBAGENT_DEPTH`; deeper directories
 * are ignored with a warning.
 */
async function discoverAgentDir(
  dir: string,
  name: string,
  depth: number,
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
  const processors = await discoverProcessors(join(dir, 'processors'));
  const skills = await discoverSkills(join(dir, 'skills'));
  const subagents = await discoverSubagents(dir, depth, onWarn);

  return {
    name,
    dir: slash(dir),
    configPath,
    instructionsPath,
    workspacePath,
    memoryPath,
    workspaceSeedDir,
    tools,
    inputProcessors: processors.input,
    outputProcessors: processors.output,
    skills,
    subagents,
  };
}

/**
 * Discover declared subagents under `<dir>/subagents/*`. `parentDepth` is the
 * parent agent's nesting level (`0` for top-level agents). Discovery recurses
 * until `MAX_FS_SUBAGENT_DEPTH` levels of subagents; a `subagents/` directory
 * that would exceed the cap is skipped with a warning.
 */
async function discoverSubagents(
  parentDir: string,
  parentDepth: number,
  onWarn?: (message: string) => void,
): Promise<DiscoveredFsAgent[]> {
  const subagentsDir = join(parentDir, 'subagents');
  if (!(await exists(subagentsDir))) {
    return [];
  }

  if (parentDepth >= MAX_FS_SUBAGENT_DEPTH) {
    onWarn?.(
      `Ignoring subagents in "${slash(subagentsDir)}": subagents may only nest ${MAX_FS_SUBAGENT_DEPTH} levels below a top-level agent.`,
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
    const child = await discoverAgentDir(dir, name, parentDepth + 1, onWarn);
    if (child) {
      subagents.push(child);
    }
  }

  return subagents;
}

/**
 * Scan `<mastraDir>/agents/*` for file-system routed agents. A directory is
 * treated as an agent only when it contains a `config.(ts|js)` or an
 * `instructions.md`; other directories are ignored. Each agent may declare
 * `subagents/` up to `MAX_FS_SUBAGENT_DEPTH` levels deep. Returns descriptors
 * with absolute, slash-normalized paths ready for codegen. Performs no module
 * evaluation — only filesystem inspection.
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
    const agent = await discoverAgentDir(dir, name, 0, onWarn);
    if (agent) {
      discovered.push(agent);
    }
  }

  return discovered;
}

/**
 * A file-system routed workflow file discovered under `<mastraDir>/workflows/`.
 * All paths are absolute and slash-normalized so they can be embedded into
 * generated module source on any platform.
 */
export interface DiscoveredFsWorkflow {
  /** Workflow key derived from the filename (without extension). */
  key: string;
  /** Absolute, slash-normalized path to the workflow module. */
  path: string;
}

/**
 * Scan `<mastraDir>/workflows/` for file-system routed workflow modules. Only
 * files whose source contains an `export default` are treated as fs-routed
 * workflows — this convention distinguishes them from workflow files that are
 * manually imported and registered programmatically. Returns descriptors with
 * absolute, slash-normalized paths ready for codegen. Performs no module
 * evaluation — only filesystem and source-text inspection.
 */
export async function discoverFsWorkflows(mastraDir: string): Promise<DiscoveredFsWorkflow[]> {
  const workflowsDir = join(mastraDir, 'workflows');
  if (!(await exists(workflowsDir))) {
    return [];
  }

  let entries: string[];
  try {
    entries = await readdir(workflowsDir);
  } catch {
    return [];
  }

  const discovered: DiscoveredFsWorkflow[] = [];
  for (const basename of entries.sort()) {
    if (isTestFile(basename)) {
      continue;
    }
    if (!TOOL_EXTENSIONS.some(ext => basename.endsWith(ext))) {
      continue;
    }
    const path = join(workflowsDir, basename);
    const stats = await lstat(path);
    if (stats.isSymbolicLink() || stats.isDirectory()) {
      continue;
    }
    // Convention: only files with `export default` are fs-routed workflows.
    // Files using named exports are assumed to be manually imported.
    const source = await readFile(path, 'utf-8');
    if (!/\bexport\s+default\b/.test(source)) {
      continue;
    }
    discovered.push({ key: toolKey(basename), path: slash(path) });
  }

  return discovered;
}

/**
 * A discovered singleton config file under `<mastraDir>/`. All paths are
 * absolute and slash-normalized so they can be embedded into generated module
 * source on any platform.
 */
export interface DiscoveredFsSingleton {
  /** Absolute, slash-normalized path to the singleton module. */
  path: string;
}

const SINGLETON_EXTENSIONS = ['.ts', '.js', '.mts', '.mjs'];

/** Safe singleton identifier: no path separators, `..`, or other traversal. */
const SINGLETON_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Check for a singleton config file (e.g. `storage.ts`, `storage.js`) directly
 * under `<mastraDir>`. Returns the first matching file path or `undefined`.
 * Symlinks are rejected for security.
 *
 * Convention: only files with `export default` are fs-routed singletons. Files
 * using named exports are assumed to be manually imported into the user's
 * `index.ts`, so they are ignored to remain backward-compatible with existing
 * project structures.
 *
 * `name` must be a bare identifier — path separators and traversal sequences are
 * rejected so the lookup can never escape `<mastraDir>`.
 */
export async function discoverFsSingleton(mastraDir: string, name: string): Promise<DiscoveredFsSingleton | undefined> {
  if (!SINGLETON_NAME_PATTERN.test(name)) {
    throw new Error(`Invalid fs-singleton name ${JSON.stringify(name)}: expected a bare identifier.`);
  }

  for (const ext of SINGLETON_EXTENSIONS) {
    const candidate = join(mastraDir, `${name}${ext}`);
    try {
      const stats = await lstat(candidate);
      if (!stats.isFile() || stats.isSymbolicLink()) {
        continue;
      }
      const source = await readFile(candidate, 'utf-8');
      // Only files with a default export are fs-routed. A named-export file with
      // this name is user-managed, so skip it and keep scanning other extensions.
      if (!/\bexport\s+default\b/.test(source)) {
        continue;
      }
      return { path: slash(candidate) };
    } catch {
      // not present
    }
  }
  return undefined;
}
