import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

export type CodingAgentSkill = 'claude-code' | 'droid' | 'pi' | 'universal';

interface DetectCodingAgentSkillsOptions {
  env?: { PATH?: string; PATHEXT?: string };
  platform?: NodeJS.Platform;
}

export type AgentResult = [
  executable: 'claude' | 'droid' | 'pi' | 'codex' | 'cursor-agent' | 'gemini' | 'opencode' | '',
  skill: CodingAgentSkill,
];

const EXECUTABLE_SKILLS: ReadonlyArray<AgentResult> = [
  ['claude', 'claude-code'],
  ['droid', 'droid'],
  ['pi', 'pi'],
  ['codex', 'universal'],
  ['cursor-agent', 'universal'],
  ['gemini', 'universal'],
  ['opencode', 'universal'],
];

const DEFAULT_WINDOWS_PATHEXT = '.COM;.EXE;.BAT;.CMD';

export async function detectCodingAgentSkills({
  env = process.env,
  platform = process.platform,
}: DetectCodingAgentSkillsOptions = {}): Promise<AgentResult[]> {
  const pathDirectories = (env.PATH ?? '')
    .split(platform === 'win32' ? ';' : path.delimiter)
    .map(directory => directory.trim())
    .filter(Boolean);

  if (pathDirectories.length === 0) return [['', 'universal']];

  const windowsExtensions = platform === 'win32' ? parseWindowsExtensions(env.PATHEXT) : [];
  const detected: AgentResult[] = [];

  for (const [executable, skill] of EXECUTABLE_SKILLS) {
    const found = await hasExecutable({ executable, pathDirectories, platform, windowsExtensions });
    if (found && !detected.some(([, s]) => s === skill)) detected.push([executable, skill]);
  }

  return detected.length > 0 ? detected : [['', 'universal']];
}

function parseWindowsExtensions(pathExt: string | undefined): string[] {
  const value = pathExt?.trim() ? pathExt : DEFAULT_WINDOWS_PATHEXT;
  const extensions: string[] = [];

  for (const entry of value.split(';')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const normalized = `${trimmed.startsWith('.') ? '' : '.'}${trimmed}`.toUpperCase();
    if (!extensions.includes(normalized)) extensions.push(normalized);
  }

  return extensions.length > 0 ? extensions : DEFAULT_WINDOWS_PATHEXT.split(';');
}

async function hasExecutable({
  executable,
  pathDirectories,
  platform,
  windowsExtensions,
}: {
  executable: string;
  pathDirectories: string[];
  platform: NodeJS.Platform;
  windowsExtensions: string[];
}): Promise<boolean> {
  for (const directory of pathDirectories) {
    if (platform === 'win32') {
      if (await hasWindowsExecutable(directory, executable, windowsExtensions)) return true;
    } else if (await hasPosixExecutable(directory, executable)) {
      return true;
    }
  }

  return false;
}

async function hasPosixExecutable(directory: string, executable: string): Promise<boolean> {
  const candidate = path.join(directory, executable);
  try {
    const stats = await fs.stat(candidate);
    if (!stats.isFile()) return false;
    await fs.access(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function hasWindowsExecutable(directory: string, executable: string, extensions: string[]): Promise<boolean> {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const candidates = new Set(extensions.map(extension => `${executable}${extension}`.toLowerCase()));
    return entries.some(entry => entry.isFile() && candidates.has(entry.name.toLowerCase()));
  } catch {
    return false;
  }
}
