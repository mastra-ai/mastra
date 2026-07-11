import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { loadBehaviorDirectory } from './loader.js';
import { defineBehavior } from './normalize.js';
import { BehaviorDefinitionError, type BehaviorDefinitionInput } from './types.js';

const input: BehaviorDefinitionInput = {
  id: 'debug',
  version: '1',
  initialState: 'understand',
  states: [
    {
      id: 'understand',
      instructions: 'Understand the issue.',
      judgeInstructions: 'Require a proven cause.',
      skills: [],
      transitions: [
        { id: 'test', target: 'test', guards: [{ id: 'cause-proven' }], judge: true },
        { id: 'exit', target: 'exit', exit: true },
      ],
    },
    {
      id: 'test',
      instructions: 'Write a failing test.',
      transitions: [{ id: 'exit', target: 'exit', exit: true }],
      periodic: { intervalMs: 1000, transition: 'exit' },
    },
  ],
  migrations: { investigate: 'understand' },
};

let tempDir: string | undefined;
afterEach(async () => {
  if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

async function writeFixture(definition = input): Promise<string> {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'behavior-definition-'));
  await fs.mkdir(path.join(tempDir, 'states', 'understand', 'skills', 'research'), { recursive: true });
  await fs.writeFile(path.join(tempDir, 'states', 'understand', 'AGENTS.md'), 'Understand the issue.');
  await fs.writeFile(path.join(tempDir, 'states', 'understand', 'JUDGE.md'), 'Require a proven cause.');
  const manifest = JSON.stringify({
    ...definition,
    states: definition.states.map(state =>
      state.id === 'understand'
        ? {
            ...state,
            instructions: undefined,
            judgeInstructions: undefined,
            agentsFile: 'states/understand/AGENTS.md',
            judgeFile: 'states/understand/JUDGE.md',
            skills: ['skills/research'],
          }
        : state,
    ),
  });
  await fs.writeFile(path.join(tempDir, 'behavior.yaml'), manifest);
  return tempDir!;
}

describe('behavior definitions', () => {
  it('normalizes programmatic definitions into an immutable graph', () => {
    const behavior = defineBehavior(input);
    expect(Object.keys(behavior.states)).toEqual(['understand', 'test']);
    expect(behavior.states.understand?.transitions[0]).toMatchObject({ id: 'test', judge: true, exit: false });
    expect(Object.isFrozen(behavior.states.understand?.transitions)).toBe(true);
  });

  it('loads filesystem assets into the same graph semantics', async () => {
    const root = await writeFixture();
    const behavior = await loadBehaviorDirectory(root);
    expect(behavior.states.understand).toMatchObject({
      instructions: 'Understand the issue.',
      judgeInstructions: 'Require a proven cause.',
    });
    expect(behavior.states.understand?.skills[0]).toBe(
      await fs.realpath(path.join(root, 'states', 'understand', 'skills', 'research')),
    );
  });

  it.each([
    ['duplicate states', { ...input, states: [...input.states, input.states[0]!] }, 'duplicate state ID'],
    ['missing target', { ...input, states: [{ ...input.states[0]!, transitions: [{ id: 'bad', target: 'missing' }, { id: 'exit', target: 'exit', exit: true }] }] }, 'unknown state'],
    ['missing exit', { ...input, states: [{ ...input.states[0]!, transitions: [{ id: 'loop', target: 'understand' }] }] }, 'exit transition'],
    ['bad schedule', { ...input, states: input.states.map(state => state.id === 'test' ? { ...state, periodic: { intervalMs: 0, transition: 'exit' } } : state) }, 'positive number'],
    ['unsafe state ID', { ...input, initialState: '../outside', states: [{ ...input.states[0]!, id: '../outside' }] }, 'may contain only'],
  ])('rejects %s', (_name, definition, message) => {
    expect(() => defineBehavior(definition as BehaviorDefinitionInput)).toThrow(message);
  });

  it('rejects unreachable states', () => {
    const unreachable = { id: 'orphan', transitions: [{ id: 'exit', target: 'exit', exit: true }] };
    expect(() => defineBehavior({ ...input, states: [...input.states, unreachable] })).toThrow('unreachable');
  });

  it('rejects filesystem state ID traversal before resolving assets', async () => {
    const root = await writeFixture();
    const manifest = JSON.parse(await fs.readFile(path.join(root, 'behavior.yaml'), 'utf8'));
    manifest.initialState = '../../../outside';
    manifest.states[0].id = '../../../outside';
    manifest.states[0].skills = ['secret'];
    await fs.writeFile(path.join(root, 'behavior.yaml'), JSON.stringify(manifest));
    await expect(loadBehaviorDirectory(root)).rejects.toThrow('may contain only');
  });

  it('rejects traversal and symlink escape', async () => {
    const root = await writeFixture();
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'behavior-outside-'));
    await fs.mkdir(path.join(root, 'states', 'understand', 'skills'), { recursive: true });
    await fs.symlink(outside, path.join(root, 'states', 'understand', 'skills', 'outside'));
    const manifest = JSON.parse(await fs.readFile(path.join(root, 'behavior.yaml'), 'utf8'));
    manifest.states[0].skills = ['skills/outside'];
    await fs.writeFile(path.join(root, 'behavior.yaml'), JSON.stringify(manifest));
    await expect(loadBehaviorDirectory(root)).rejects.toBeInstanceOf(BehaviorDefinitionError);
    await fs.rm(outside, { recursive: true, force: true });
  });
});
