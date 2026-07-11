import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

import { normalizeBehavior } from './normalize.js';
import type { BehaviorDefinitionInput, BehaviorStateInput, NormalizedBehaviorDefinition } from './types.js';
import { BehaviorDefinitionError } from './types.js';

async function resolveInside(root: string, candidate: string, field: string): Promise<string> {
  if (path.isAbsolute(candidate)) throw new BehaviorDefinitionError([{ path: field, message: 'absolute paths are not allowed' }]);
  const resolved = path.resolve(root, candidate);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new BehaviorDefinitionError([{ path: field, message: 'path escapes the behavior directory' }]);
  }
  const real = await fs.realpath(resolved);
  const realRelative = path.relative(root, real);
  if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
    throw new BehaviorDefinitionError([{ path: field, message: 'symlink escapes the behavior directory' }]);
  }
  return real;
}

async function readAsset(root: string, candidate: string | undefined, field: string): Promise<string | undefined> {
  if (!candidate) return undefined;
  return fs.readFile(await resolveInside(root, candidate, field), 'utf8');
}

function assertDefinition(value: unknown): asserts value is BehaviorDefinitionInput {
  if (!value || typeof value !== 'object') {
    throw new BehaviorDefinitionError([{ path: 'behavior.yaml', message: 'must contain an object' }]);
  }
  const candidate = value as Partial<BehaviorDefinitionInput>;
  if (!Array.isArray(candidate.states)) {
    throw new BehaviorDefinitionError([{ path: 'states', message: 'must be an array' }]);
  }
}

export async function loadBehaviorDirectory(directory: string): Promise<NormalizedBehaviorDefinition> {
  const root = await fs.realpath(directory);
  const manifestPath = await resolveInside(root, 'behavior.yaml', 'behavior.yaml');
  let parsed: unknown;
  try {
    parsed = parse(await fs.readFile(manifestPath, 'utf8'));
  } catch (error) {
    throw new BehaviorDefinitionError([{ path: 'behavior.yaml', message: `could not parse manifest: ${String(error)}` }]);
  }
  assertDefinition(parsed);

  const states: BehaviorStateInput[] = await Promise.all(
    parsed.states.map(async (state, index) => {
      if (!state || typeof state !== 'object') {
        throw new BehaviorDefinitionError([{ path: `states[${index}]`, message: 'must be an object' }]);
      }
      const item = state as BehaviorStateInput;
      if (!item.id || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(item.id)) {
        throw new BehaviorDefinitionError([
          { path: `states[${index}].id`, message: 'may contain only letters, numbers, dots, underscores, and hyphens' },
        ]);
      }
      const stateRoot = path.join(root, 'states', item.id);
      const instructions = item.instructions ?? (await readAsset(root, item.agentsFile, `states[${index}].agentsFile`));
      const judgeInstructions =
        item.judgeInstructions ?? (await readAsset(root, item.judgeFile, `states[${index}].judgeFile`));
      const skills = await Promise.all(
        (item.skills ?? []).map(skill => resolveInside(stateRoot, skill, `states[${index}].skills`)),
      );
      return { ...item, instructions, judgeInstructions, skills };
    }),
  );

  return normalizeBehavior({ ...parsed, states }, root);
}
