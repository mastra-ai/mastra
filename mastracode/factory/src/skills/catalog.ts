import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createSkill } from '@mastra/core/skills';
import type { InlineSkill, InlineSkillInput } from '@mastra/core/skills';

const bundleDirectory = dirname(fileURLToPath(import.meta.url));
const bundledFactorySkillsPath = join(bundleDirectory, 'factory-skills');

export const FACTORY_SKILLS_SOURCE_PATH =
  [
    bundledFactorySkillsPath,
    join(bundleDirectory, '..', 'factory-skills'),
    join(bundleDirectory, '..', '..', 'factory-skills'),
    join(process.cwd(), 'src', 'mastra', 'public', 'factory-skills'),
  ].find(existsSync) ?? bundledFactorySkillsPath;

export const FACTORY_SKILL_NAMES = new Set([
  'configure-factory-rules',
  'factory-complete-issue',
  'factory-plan',
  'factory-rereview',
  'factory-review',
  'factory-triage',
]);

export interface FactorySkillInfo {
  name: string;
  description: string;
  /** SKILL.md body with the frontmatter block removed. */
  content: string;
}

export interface FactorySkillCatalog {
  skills: InlineSkill[];
  get(name: string): InlineSkill | undefined;
  list: FactorySkillInfo[];
}

interface ParsedFrontmatter {
  name?: unknown;
  description?: unknown;
  license?: unknown;
  compatibility?: unknown;
  'user-invocable'?: unknown;
  metadata?: unknown;
}

function parseScalar(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      throw new Error(`invalid inline JSON value: ${trimmed}`);
    }
  }
  return trimmed;
}

function parseFrontmatter(raw: string): { data: ParsedFrontmatter; instructions: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match?.[1]) throw new Error('missing or malformed YAML frontmatter');

  const data: Record<string, unknown> = {};
  const lines = match[1].split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const field = line.match(/^([a-zA-Z][a-zA-Z0-9-]*):(?:\s*(.*))?$/);
    if (!field?.[1]) throw new Error(`invalid frontmatter line ${index + 1}`);
    const key = field[1];
    const rawValue = field[2] ?? '';
    if (rawValue.trim()) {
      data[key] = parseScalar(rawValue);
      continue;
    }

    const nested: Record<string, unknown> = {};
    while (index + 1 < lines.length) {
      const next = lines[index + 1]!;
      if (!/^\s+/.test(next)) break;
      index += 1;
      if (!next.trim() || next.trimStart().startsWith('#')) continue;
      const nestedField = next.match(/^\s+([a-zA-Z][a-zA-Z0-9_-]*):\s*(.*)$/);
      if (!nestedField?.[1]) throw new Error(`invalid nested frontmatter line ${index + 1}`);
      nested[nestedField[1]] = parseScalar(nestedField[2] ?? '');
    }
    data[key] = nested;
  }

  return { data: data as ParsedFrontmatter, instructions: raw.slice(match[0].length).trim() };
}

async function readReferences(skillDirectory: string): Promise<Record<string, string> | undefined> {
  const referencesDirectory = join(skillDirectory, 'references');
  let entries;
  try {
    entries = await readdir(referencesDirectory, { recursive: true, withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }

  const references: Record<string, string> = {};
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const absolutePath = join(entry.parentPath, entry.name);
    const referencePath = relative(referencesDirectory, absolutePath).split(sep).join('/');
    references[referencePath] = await readFile(absolutePath, 'utf8');
  }
  return Object.keys(references).length > 0 ? references : undefined;
}

function validateOptionalFields(name: string, data: ParsedFrontmatter): void {
  if (data.license !== undefined && typeof data.license !== 'string') {
    throw new Error(`license must be a string`);
  }
  if (data.compatibility !== undefined && typeof data.compatibility !== 'string') {
    throw new Error(`compatibility must be a string`);
  }
  if (data['user-invocable'] !== undefined && typeof data['user-invocable'] !== 'boolean') {
    throw new Error(`user-invocable must be a boolean`);
  }
  if (
    data.metadata !== undefined &&
    (typeof data.metadata !== 'object' || data.metadata === null || Array.isArray(data.metadata))
  ) {
    throw new Error(`metadata must be an object`);
  }
  if (data.name !== name) {
    throw new Error(`frontmatter name must be "${name}"`);
  }
}

async function loadBundledSkill(sourcePath: string, expectedName: string): Promise<InlineSkill> {
  const skillDirectory = join(sourcePath, expectedName);
  try {
    const raw = await readFile(join(skillDirectory, 'SKILL.md'), 'utf8');
    const { data, instructions } = parseFrontmatter(raw);
    validateOptionalFields(expectedName, data);
    if (typeof data.description !== 'string' || !data.description.trim()) {
      throw new Error('description must be a non-empty string');
    }
    if (!instructions) throw new Error('instructions must be non-empty');
    const references = await readReferences(skillDirectory);
    const input: InlineSkillInput = {
      name: expectedName,
      description: data.description.trim(),
      instructions,
      ...(data.license !== undefined ? { license: data.license as string } : {}),
      ...(data.compatibility !== undefined ? { compatibility: data.compatibility } : {}),
      ...(data['user-invocable'] !== undefined ? { 'user-invocable': data['user-invocable'] as boolean } : {}),
      ...(data.metadata !== undefined ? { metadata: data.metadata as Record<string, unknown> } : {}),
      ...(references ? { references } : {}),
    };
    return createSkill(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid bundled Factory skill "${expectedName}": ${message}`, { cause: error });
  }
}

export function createFactorySkillCatalog(skills: InlineSkill[]): FactorySkillCatalog {
  const byName = new Map<string, InlineSkill>();
  for (const skill of skills) {
    if (byName.has(skill.name)) throw new Error(`Duplicate bundled Factory skill "${skill.name}".`);
    byName.set(skill.name, skill);
  }

  const frozenSkills = [...skills];
  Object.freeze(frozenSkills);
  const list = frozenSkills.map(skill =>
    Object.freeze({ name: skill.name, description: skill.description, content: skill.instructions }),
  );
  Object.freeze(list);

  return Object.freeze({
    skills: frozenSkills,
    get: (name: string) => byName.get(name),
    list,
  });
}

export async function loadFactorySkillCatalog(options?: {
  sourcePath?: string;
  names?: Iterable<string>;
}): Promise<FactorySkillCatalog> {
  const sourcePath = options?.sourcePath ?? FACTORY_SKILLS_SOURCE_PATH;
  const names = [...(options?.names ?? FACTORY_SKILL_NAMES)].sort();
  if (new Set(names).size !== names.length) throw new Error('Duplicate bundled Factory skill names are configured.');
  const skills = await Promise.all(names.map(name => loadBundledSkill(sourcePath, name)));
  return createFactorySkillCatalog(skills);
}
