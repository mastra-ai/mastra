/**
 * Load project and global agent instruction files (AGENTS.md, CLAUDE.md).
 * Prefers AGENTS.md over CLAUDE.md when multiple exist at the same location.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import { DEFAULT_CONFIG_DIR } from '../../constants.js';

// Filenames to check, in order of preference
const INSTRUCTION_FILES = ['AGENTS.md', 'CLAUDE.md'];

// Locations to scan (relative to project root or home)
const PROJECT_LOCATIONS = [
  '', // project root
  '.claude',
  '.mastracode',
];

const GLOBAL_LOCATIONS = ['.claude', '.mastracode', '.config/claude', '.config/mastracode'];

export interface InstructionSource {
  path: string;
  content: string;
  scope: 'global' | 'project';
  /** Git ref the content was read from, when not read off the working tree. */
  ref?: string;
}

/**
 * Reads project-scope instruction files. The default implementation reads the
 * working tree via `fs`; alternative readers can serve content from another
 * source (e.g. a trusted git ref) while keeping working-tree paths as the
 * addressing scheme.
 */
export interface InstructionFileReader {
  exists(path: string): boolean;
  read(path: string): string;
  /** Git ref backing this reader, recorded on the loaded sources. */
  ref?: string;
}

const fsInstructionReader: InstructionFileReader = {
  exists: path => existsSync(path),
  read: path => readFileSync(path, 'utf-8'),
};

function realpathOrResolved(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

function createProjectPathResolver(projectPath: string): (path: string) => string | null {
  const canonicalRoot = realpathOrResolved(projectPath);
  return path => {
    const rel = relative(projectPath, path);
    if (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)) return rel.split(sep).join('/');

    // Match an alias of the project root, not the target of a checkout-controlled
    // descendant symlink. Missing descendants must still resolve against the ref.
    let ancestor = resolve(path);
    let projectRelativePath: string | null = null;
    while (true) {
      if (realpathOrResolved(ancestor) === canonicalRoot) {
        projectRelativePath = relative(ancestor, path).split(sep).join('/');
      }
      const parent = dirname(ancestor);
      if (parent === ancestor) return projectRelativePath;
      ancestor = parent;
    }
  };
}

const GIT_OBJECT_CACHE_LIMIT = 10_000;
const gitObjectOutputs = new Map<string, string>();

// The cache is shared by every checkout in the process, so a read is kept only once it is known to
// match its id: git checks the tree it is asked to list, and `matchesId` covers what git does not check.
// A blobless clone fetches file content over the network, so a failed read is never cached.
function gitObjectRead(
  projectPath: string,
  args: string[],
  matchesId: (output: Buffer) => boolean = () => true,
): string | null {
  const key = args.join('\0');
  const cached = gitObjectOutputs.get(key);
  if (cached !== undefined) return cached;
  try {
    const raw = execFileSync('git', ['--no-replace-objects', '-C', projectPath, '--literal-pathspecs', ...args], {
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 1024 * 1024,
    });
    if (!matchesId(raw)) return null;
    const output = raw.toString('utf-8');
    if (gitObjectOutputs.size >= GIT_OBJECT_CACHE_LIMIT) gitObjectOutputs.delete(gitObjectOutputs.keys().next().value!);
    gitObjectOutputs.set(key, output);
    return output;
  } catch {
    return null;
  }
}

function blobMatchesId(id: string, content: Buffer): boolean {
  const hash = createHash(id.length === 40 ? 'sha1' : 'sha256');
  return hash.update(`blob ${content.length}\0`).update(content).digest('hex') === id;
}

function createGitRefLookup(projectPath: string, ref: string) {
  let trees: string[] | undefined;
  const resolveTrees = (): string[] => {
    try {
      const output = execFileSync('git', ['-C', projectPath, 'cat-file', '--batch-check=%(objectname)'], {
        encoding: 'utf-8',
        input: `origin/${ref}^{tree}\n${ref}^{tree}\n`,
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      return [...new Set(output.split('\n').filter(line => /^[0-9a-f]+$/.test(line)))];
    } catch {
      return [];
    }
  };
  // One folder level per call: git hash-checks the tree it lists, not the trees it walks through.
  const entryAt = (tree: string, rel: string): string[] => {
    let entry = ['', 'tree', tree];
    for (const name of rel.split('/')) {
      if (entry[1] !== 'tree') return [];
      entry = gitObjectRead(projectPath, ['ls-tree', '--full-tree', entry[2]!, '--', name])?.split(/\s/) ?? [];
    }
    return entry;
  };
  return {
    type: (rel: string): string | null => {
      for (const tree of (trees ??= resolveTrees())) {
        const [, type] = entryAt(tree, rel);
        if (type) return type;
      }
      return null;
    },
    show: (rel: string): string | null => {
      for (const tree of (trees ??= resolveTrees())) {
        const [, type, blob] = entryAt(tree, rel);
        if (type !== 'blob' || !blob) continue;
        const content = gitObjectRead(projectPath, ['cat-file', 'blob', blob], raw => blobMatchesId(blob, raw));
        if (content !== null) return content;
      }
      return null;
    },
  };
}

/**
 * Create a reader that serves instruction files from a git ref instead of the
 * working tree. Paths are still addressed as working-tree paths under
 * `projectPath`; content comes from the blob at `<ref>:<relpath>` so an untrusted
 * checkout (e.g. a PR branch under review) cannot influence what is loaded.
 * Tries `origin/<ref>` first (remote truth), then the local ref. Any git
 * failure (missing ref, missing file, no repo) reports the file as absent.
 */
export function createGitRefInstructionReader(projectPath: string, ref: string): InstructionFileReader {
  const toRelative = createProjectPathResolver(projectPath);
  const lookup = createGitRefLookup(projectPath, ref);
  const show = (path: string): string | null => {
    const rel = toRelative(path);
    return rel ? lookup.show(rel) : null;
  };
  return {
    ref,
    exists: path => show(path) !== null,
    read: path => {
      const content = show(path);
      if (content === null) throw new Error(`Not found at ref ${ref}: ${path}`);
      return content;
    },
  };
}

/**
 * Reader for the reactive reminder channel (AgentsMDInjector) that serves
 * paths under `projectPath` from a trusted git ref. Paths outside the project
 * fall back to the operator machine's filesystem (those are trusted); paths
 * inside the project are only ever resolved against the ref, never the
 * working tree, so an untrusted checkout cannot feed content in.
 */
export function createGitRefReminderReader(
  projectPath: string,
  ref: string,
): {
  pathExists: (path: string) => boolean;
  isDirectory: (path: string) => boolean;
  readFile: (path: string) => string;
  getPathIdentity: (path: string) => string;
} {
  const toRelative = createProjectPathResolver(projectPath);
  const canonicalRoot = realpathOrResolved(projectPath);
  const lookup = createGitRefLookup(projectPath, ref);
  const objectType = (rel: string): string | null => {
    if (rel === '') return 'tree'; // project root
    return lookup.type(rel);
  };
  return {
    pathExists: path => {
      const rel = toRelative(path);
      if (rel === null) return existsSync(path);
      return objectType(rel) !== null;
    },
    isDirectory: path => {
      const rel = toRelative(path);
      if (rel === null) {
        try {
          return statSync(path).isDirectory();
        } catch {
          return false;
        }
      }
      return objectType(rel) === 'tree';
    },
    readFile: path => {
      const rel = toRelative(path);
      if (rel === null) return readFileSync(path, 'utf-8');
      const content = rel ? lookup.show(rel) : null;
      if (content === null) throw new Error(`Not found at ref ${ref}: ${path}`);
      return content;
    },
    getPathIdentity: path => {
      const rel = toRelative(path);
      // Only canonicalize the project root: checkout symlinks do not define
      // file identity in the trusted ref, including files missing on disk.
      return rel === null ? realpathOrResolved(path) : join(canonicalRoot, rel);
    },
  };
}

/**
 * Find the first existing instruction file at a given base path.
 * Prefers AGENTS.md over CLAUDE.md.
 */
function findInstructionFile(basePath: string, reader: InstructionFileReader = fsInstructionReader): string | null {
  for (const filename of INSTRUCTION_FILES) {
    const fullPath = join(basePath, filename);
    if (reader.exists(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

/**
 * Load all agent instruction files from global and project locations.
 * Returns an array of instruction sources, with global ones first.
 *
 * `projectReader` controls where project-scope content comes from (defaults to
 * the working tree). Global instructions read the operator machine's
 * filesystem, unless `skipGlobal` keeps them out entirely.
 */
export function loadAgentInstructions(
  projectPath: string,
  configDirName = DEFAULT_CONFIG_DIR,
  projectReader: InstructionFileReader = fsInstructionReader,
  { skipGlobal = false }: { skipGlobal?: boolean } = {},
): InstructionSource[] {
  const sources: InstructionSource[] = [];
  const home = homedir();

  // Derive location arrays from the base constants, substituting the config dir name
  const projectLocations = PROJECT_LOCATIONS.map(loc => (loc === '.mastracode' ? configDirName : loc));
  const globalLocations = skipGlobal
    ? []
    : GLOBAL_LOCATIONS.map(loc => {
        if (loc === '.mastracode') return configDirName;
        // XDG-style path (~/.config/<name>): strip the leading dot since the
        // .config/ prefix already signals a hidden/config directory.
        if (loc === '.config/mastracode') return '.config/' + configDirName.replace(/^\./, '');
        return loc;
      });

  // Load global instructions first
  for (const location of globalLocations) {
    const basePath = join(home, location);
    const filePath = findInstructionFile(basePath);
    if (filePath) {
      try {
        const content = readFileSync(filePath, 'utf-8').trim();
        if (content) {
          sources.push({ path: filePath, content, scope: 'global' });
          break; // Only use first found global instruction file
        }
      } catch {
        // Skip unreadable files
      }
    }
  }

  // Load project instructions
  for (const location of projectLocations) {
    const basePath = location ? join(projectPath, location) : projectPath;
    const filePath = findInstructionFile(basePath, projectReader);
    if (filePath) {
      try {
        const content = projectReader.read(filePath).trim();
        if (content) {
          sources.push({
            path: filePath,
            content,
            scope: 'project',
            ...(projectReader.ref ? { ref: projectReader.ref } : {}),
          });
          break; // Only use first found project instruction file
        }
      } catch {
        // Skip unreadable files
      }
    }
  }

  return sources;
}

export function getStaticallyLoadedInstructionPaths(
  projectPath: string,
  configDirName = DEFAULT_CONFIG_DIR,
  projectReader?: InstructionFileReader,
): string[] {
  return instructionSourcePaths(loadAgentInstructions(projectPath, configDirName, projectReader), [projectPath]);
}

/**
 * Directories a session's project instructions load from: the host's
 * `instructionRoots` (resolved against the working directory, the session's
 * own checkout first) when it sets any, else the working directory itself.
 */
export function sessionInstructionRoots(workingDir: string, instructionRoots?: readonly string[]): string[] {
  if (!instructionRoots?.length) return [workingDir];
  return [...new Set(instructionRoots.map(root => resolve(workingDir, root)))];
}

/**
 * The instruction files a session's system prompt carries. Global files load
 * once (unless `skipGlobal`), then each instruction root's project files, in
 * root order. An untrusted checkout never reads project files off the working
 * tree: with a `baseRef` the first root (the session's own checkout) is served
 * from that ref and the other roots are skipped; without one no project files
 * load.
 */
export function loadSessionInstructions({
  workingDir,
  instructionRoots,
  configDir,
  untrustedCheckout = false,
  baseRef,
  skipGlobal = false,
}: {
  workingDir: string;
  instructionRoots?: readonly string[];
  configDir?: string;
  untrustedCheckout?: boolean;
  baseRef?: string;
  skipGlobal?: boolean;
}): InstructionSource[] {
  const [primary, ...others] = sessionInstructionRoots(workingDir, instructionRoots);
  const primaryReader = untrustedCheckout
    ? baseRef
      ? createGitRefInstructionReader(primary!, baseRef)
      : { exists: () => false, read: () => '' }
    : undefined;
  const sources = loadAgentInstructions(primary!, configDir, primaryReader, { skipGlobal });
  if (untrustedCheckout) return sources;
  for (const root of others) {
    sources.push(...loadAgentInstructions(root, configDir, undefined, { skipGlobal: true }));
  }
  return sources;
}

/**
 * Paths of loaded instruction sources, each project source also under its
 * root's canonical path, so reactive reminders never repeat a file the
 * system prompt already carries.
 */
export function instructionSourcePaths(sources: InstructionSource[], roots: readonly string[]): string[] {
  return sources.flatMap(source => {
    const path = normalize(source.path);
    if (source.scope !== 'project') return [path];
    const root = roots.find(candidate => {
      const rel = relative(candidate, path);
      return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
    });
    if (!root) return [path];
    const canonicalPath = join(realpathOrResolved(root), relative(root, path));
    return path === canonicalPath ? [path] : [path, canonicalPath];
  });
}

/** Heading the agent-instructions block is introduced by in the system prompt. */
export const AGENT_INSTRUCTIONS_HEADING = '# Agent Instructions';

/**
 * Format a single instruction source as it appears in the system prompt.
 *
 * Exported so callers that attribute prompt cost per source (the `/context`
 * audit) measure the exact block that is sent rather than reconstructing it.
 */
export function formatInstructionSource(source: InstructionSource): string {
  const label = source.scope === 'global' ? 'Global' : 'Project';
  const origin = source.ref ? `${source.path} (at ref ${source.ref})` : source.path;
  return `<!-- ${label} instructions from ${origin} -->\n${source.content}`;
}

/**
 * Format loaded instructions into a string for the system prompt.
 */
export function formatAgentInstructions(sources: InstructionSource[]): string {
  if (sources.length === 0) return '';

  const sections = sources.map(formatInstructionSource);

  return `\n${AGENT_INSTRUCTIONS_HEADING}\n\n${sections.join('\n\n')}\n`;
}
