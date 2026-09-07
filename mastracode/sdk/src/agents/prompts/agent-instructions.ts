/**
 * Load project and global agent instruction files (AGENTS.md, CLAUDE.md).
 * Prefers AGENTS.md over CLAUDE.md when multiple exist at the same location.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, normalize, relative, sep } from 'node:path';
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

/**
 * Create a reader that serves instruction files from a git ref instead of the
 * working tree. Paths are still addressed as working-tree paths under
 * `projectPath`; content comes from `git show <ref>:<relpath>` so an untrusted
 * checkout (e.g. a PR branch under review) cannot influence what is loaded.
 * Tries `origin/<ref>` first (remote truth), then the local ref. Any git
 * failure (missing ref, missing file, no repo) reports the file as absent.
 */
export function createGitRefInstructionReader(projectPath: string, ref: string): InstructionFileReader {
  const toRelative = (path: string): string | null => {
    const rel = relative(projectPath, path);
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) return null;
    return rel.split(sep).join('/');
  };
  const show = (path: string): string | null => {
    const rel = toRelative(path);
    if (rel === null) return null;
    for (const candidate of [`origin/${ref}`, ref]) {
      try {
        return execFileSync('git', ['-C', projectPath, 'show', `${candidate}:${rel}`], {
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
          maxBuffer: 1024 * 1024,
        });
      } catch {
        // Ref or file missing at this candidate — try the next one.
      }
    }
    return null;
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
} {
  const gitReader = createGitRefInstructionReader(projectPath, ref);
  const toRelative = (path: string): string | null => {
    const rel = relative(projectPath, normalize(path));
    if (rel.startsWith('..') || isAbsolute(rel)) return null;
    return rel.split(sep).join('/');
  };
  const objectType = (rel: string): string | null => {
    if (rel === '') return 'tree'; // project root
    for (const candidate of [`origin/${ref}`, ref]) {
      try {
        return execFileSync('git', ['-C', projectPath, 'cat-file', '-t', `${candidate}:${rel}`], {
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
      } catch {
        // Ref or object missing at this candidate — try the next one.
      }
    }
    return null;
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
      return gitReader.read(path);
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
  return loadAgentInstructions(projectPath, configDirName, projectReader).map(source => normalize(source.path));
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
