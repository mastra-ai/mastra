import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { WorkspaceFilesystem } from '@mastra/core/workspace';
import { parse as parseYaml } from 'yaml';
import { DEFAULT_CONFIG_DIR } from '../constants.js';
import { isPathWithinRoot } from './path-security.js';

/**
 * Metadata for a slash command
 */
export interface SlashCommandMetadata {
  /** Command name (e.g., "git:commit") */
  name: string;
  /** Human-readable description */
  description: string;
  /** The command template with variables */
  template: string;
  /** Source file path */
  sourcePath: string;
  /** Namespace derived from directory structure */
  namespace?: string;
  /** Whether this command should also be exposed as /goal/<name> */
  goal?: boolean;
}

/**
 * Parse raw command-file content into metadata and template.
 * Supports both frontmatter-based and plain markdown files.
 */
export function parseCommandSource(content: string, sourcePath: string, baseDir?: string): SlashCommandMetadata | null {
  const trimmedContent = content.trim();

  // Check if file has frontmatter (starts with ---)
  if (!trimmedContent.startsWith('---')) {
    // No frontmatter - treat entire file as template
    // Derive name from file path
    const name = baseDir ? extractCommandName(sourcePath, baseDir) : path.basename(sourcePath, '.md');

    return {
      name,
      description: '',
      template: content,
      sourcePath,
    };
  }

  // Split frontmatter and template
  const parts = content.split('---');
  if (parts.length < 3) {
    return null;
  }

  const frontmatter = parts[1]!.trim();
  const template = parts.slice(2).join('---').trim();

  let metadata: Record<string, unknown>;
  try {
    metadata = parseYaml(frontmatter) as Record<string, unknown>;
  } catch {
    return null;
  }

  // Derive name from file path if not specified in frontmatter
  let name: string;
  if (typeof metadata?.name === 'string' && metadata.name) {
    name = metadata.name;
  } else if (baseDir) {
    name = extractCommandName(sourcePath, baseDir);
  } else {
    name = path.basename(sourcePath, '.md');
  }

  return {
    name,
    description: typeof metadata?.description === 'string' ? metadata.description : '',
    template,
    sourcePath,
    namespace: typeof metadata?.namespace === 'string' ? metadata.namespace : undefined,
    goal: metadata?.goal === true,
  };
}

/**
 * Parse a command file and extract metadata and template
 * Supports both frontmatter-based and plain markdown files
 */
export async function parseCommandFile(filePath: string, baseDir?: string): Promise<SlashCommandMetadata | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return parseCommandSource(content, filePath, baseDir);
  } catch (error) {
    console.error(`Error parsing command file ${filePath}:`, error);
    return null;
  }
}

/**
 * Extract command name from file path
 * Converts path like "git/commit.md" to "git:commit"
 */
export function extractCommandName(filePath: string, baseDir: string): string {
  const relativePath = path.relative(baseDir, filePath);
  const dirName = path.dirname(relativePath);
  const baseName = path.basename(relativePath, '.md');

  if (dirName === '.' || dirName === '') {
    return baseName;
  }

  // Replace path separators with colons for namespacing
  const namespace = dirName.replace(/[\\/]/g, ':');
  return `${namespace}:${baseName}`;
}

/**
 * Recursively scan a directory for command files.
 * @param dirPath - Current directory to scan
 * @param rootDir - Original root commands directory (used for namespace derivation).
 *                  When omitted the first call sets it to dirPath.
 */
export interface ScanCommandDirectoryOptions {
  allowedRoot?: string;
  visitedDirectories?: Set<string>;
}

async function isContainedWithin(fullPath: string, rootDir: string): Promise<boolean> {
  try {
    const realPath = await fs.realpath(fullPath);
    const realRoot = await fs.realpath(rootDir);
    return isPathWithinRoot(realPath, realRoot);
  } catch {
    return false;
  }
}

export async function scanCommandDirectory(
  dirPath: string,
  rootDir?: string,
  options: ScanCommandDirectoryOptions = {},
): Promise<SlashCommandMetadata[]> {
  const baseDir = rootDir ?? dirPath;
  const commands: SlashCommandMetadata[] = [];
  const visitedDirectories = options.visitedDirectories ?? new Set<string>();

  try {
    const realDirectory = await fs.realpath(dirPath);
    const realAllowedRoot = options.allowedRoot ? await fs.realpath(options.allowedRoot) : undefined;
    if (realAllowedRoot && !isPathWithinRoot(realDirectory, realAllowedRoot)) return commands;
    if (visitedDirectories.has(realDirectory)) return commands;
    visitedDirectories.add(realDirectory);

    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === 'node_modules') continue;

      const fullPath = path.join(dirPath, entry.name);
      const stats = entry.isSymbolicLink() ? await fs.stat(fullPath).catch(() => null) : entry;
      if (!stats) continue;

      if (stats.isDirectory()) {
        // Recursively scan subdirectories, preserving the root directory for namespace derivation
        const subCommands = await scanCommandDirectory(fullPath, baseDir, {
          ...options,
          visitedDirectories,
        });
        commands.push(...subCommands);
      } else if (entry.name.endsWith('.md') && stats.isFile()) {
        if (realAllowedRoot) {
          const realFile = await fs.realpath(fullPath).catch(() => null);
          if (!realFile || !isPathWithinRoot(realFile, realAllowedRoot)) continue;
        }

        // Parse markdown command files, passing the root commands dir as baseDir for name derivation
        const command = await parseCommandFile(fullPath, baseDir);
        if (command) {
          commands.push(command);
        }
      }
    }
  } catch {
    // Directory doesn't exist or can't be read - silently skip
  }

  return commands;
}

function mergeByName(groups: SlashCommandMetadata[][]): SlashCommandMetadata[] {
  const commandMap = new Map<string, SlashCommandMetadata>();
  for (const group of groups) {
    for (const command of group) {
      commandMap.set(command.name, command);
    }
  }
  return Array.from(commandMap.values());
}

/**
 * Load runtime-user global custom commands (~/.opencode/command, then
 * ~/.claude/commands, then ~/<configDir>/commands — later sources win).
 */
export async function loadGlobalCustomCommands(configDirName = DEFAULT_CONFIG_DIR): Promise<SlashCommandMetadata[]> {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (!homeDir) return [];

  return mergeByName([
    await scanCommandDirectory(path.join(homeDir, '.opencode', 'command')),
    await scanCommandDirectory(path.join(homeDir, '.claude', 'commands')),
    await scanCommandDirectory(path.join(homeDir, configDirName, 'commands')),
  ]);
}

/**
 * Load custom commands from explicit directories in order — later directories
 * override earlier ones on name collisions. When `allowedRoot` is omitted each
 * directory contains itself; pass a wider trusted root (e.g. the project dir)
 * to reject command directories that are themselves symlinks out of it.
 */
export async function loadCommandDirectories(
  directories: string[],
  options: { allowedRoot?: string } = {},
): Promise<SlashCommandMetadata[]> {
  const groups: SlashCommandMetadata[][] = [];
  for (const directory of directories) {
    groups.push(await scanCommandDirectory(directory, undefined, { allowedRoot: options.allowedRoot ?? directory }));
  }
  return mergeByName(groups);
}

/**
 * Load custom slash commands from all configured directories.
 * Priority: plugin dirs > mastra project > claude project > opencode project > mastra user > claude user > opencode user
 */
export async function loadCustomCommands(
  projectDir?: string,
  configDirName = DEFAULT_CONFIG_DIR,
  extraCommandDirs: string[] = [],
): Promise<SlashCommandMetadata[]> {
  const globalCommands = await loadGlobalCustomCommands(configDirName);
  const projectCommands = projectDir
    ? await loadCommandDirectories(
        [
          path.join(projectDir, '.opencode', 'command'),
          path.join(projectDir, '.claude', 'commands'),
          path.join(projectDir, configDirName, 'commands'),
        ],
        { allowedRoot: projectDir },
      )
    : [];
  const pluginCommands = await loadCommandDirectories(extraCommandDirs);

  return mergeByName([globalCommands, projectCommands, pluginCommands]);
}

/**
 * Workspace-relative roots scanned for custom commands, in ascending
 * precedence order (later roots win on name collisions).
 */
export function workspaceCommandRoots(configDirName = DEFAULT_CONFIG_DIR): string[] {
  return ['.opencode/command', '.claude/commands', `${configDirName}/commands`];
}

function toPosixPath(p: string): string {
  return p.split(path.sep).join('/');
}

function posixJoin(...segments: string[]): string {
  return segments.join('/');
}

interface WorkspaceEntry {
  name: string;
  type: 'file' | 'directory';
}

/**
 * Recursively collect command files under a workspace-relative directory.
 * Missing directories yield no commands; unexpected list/read errors propagate.
 */
async function collectWorkspaceCommands(
  filesystem: Pick<WorkspaceFilesystem, 'exists' | 'readdir' | 'readFile'>,
  directory: string,
  baseDir: string,
): Promise<SlashCommandMetadata[]> {
  const exists = await filesystem.exists(directory);
  if (!exists) return [];

  const entries: WorkspaceEntry[] = (await filesystem.readdir(directory, {})).map(entry => ({
    name: entry.name,
    type: entry.type,
  }));
  const commands: SlashCommandMetadata[] = [];

  for (const entry of entries) {
    if (entry.name === 'node_modules') continue;
    // Plain entry names only: the workspace filesystem owns containment for
    // symlinks, but traversal segments in an entry name must never escape.
    if (entry.name.includes('/') || entry.name.includes('\\') || entry.name === '.' || entry.name === '..') continue;

    const childPath = posixJoin(directory, entry.name);

    if (entry.type === 'directory') {
      commands.push(...(await collectWorkspaceCommands(filesystem, childPath, baseDir)));
    } else if (entry.type === 'file' && entry.name.endsWith('.md')) {
      const content = await filesystem.readFile(childPath, { encoding: 'utf-8' });
      const command = parseCommandSource(
        typeof content === 'string' ? content : content.toString('utf-8'),
        childPath,
        baseDir,
      );
      if (command) commands.push(command);
    }
  }

  return commands;
}

/**
 * Load custom commands from a workspace's project roots (.opencode/command,
 * .claude/commands, <configDir>/commands — later roots win). All reads go
 * through the workspace filesystem; nothing touches the host disk.
 */
export async function loadWorkspaceCustomCommands(
  filesystem: Pick<WorkspaceFilesystem, 'exists' | 'readdir' | 'readFile'>,
  configDirName = DEFAULT_CONFIG_DIR,
): Promise<SlashCommandMetadata[]> {
  return mergeByName(
    await Promise.all(
      workspaceCommandRoots(configDirName).map(root => collectWorkspaceCommands(filesystem, root, root)),
    ),
  );
}

/**
 * Get the commands directory path for a project
 */
export function getProjectCommandsDir(projectDir: string, configDirName = DEFAULT_CONFIG_DIR): string {
  return path.join(projectDir, configDirName, 'commands');
}

/**
 * Initialize a commands directory with an example command
 */
export async function initCommandsDirectory(projectDir: string, configDirName = DEFAULT_CONFIG_DIR): Promise<void> {
  const commandsDir = getProjectCommandsDir(projectDir, configDirName);

  try {
    await fs.mkdir(commandsDir, { recursive: true });

    // Create an example command
    const examplePath = path.join(commandsDir, 'example.md');
    const exampleContent = `---
name: example
description: An example slash command
---

This is an example slash command template.
You can use variables like \$ARGUMENTS or \$1, \$2 for positional args.
You can also include file content with @filename.
Shell commands with !command will be executed and output included.
`;

    try {
      await fs.access(examplePath);
      // File already exists, don't overwrite
    } catch {
      await fs.writeFile(examplePath, exampleContent, 'utf-8');
    }
  } catch (error) {
    console.error('Error initializing commands directory:', error);
  }
}
