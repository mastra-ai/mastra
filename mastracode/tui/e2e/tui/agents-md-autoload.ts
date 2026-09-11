import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const CORE_SENTINEL = 'CORE_DIRECTORY_INSTRUCTIONS_8cba19';
const DEPLOYER_SENTINEL = 'DEPLOYER_DIRECTORY_INSTRUCTIONS_a217be';
const CORE_LOADED = /loaded packages\/core\/AGENTS\.md/g;
const DEPLOYER_LOADED = /loaded packages\/deployer\/AGENTS\.md/g;

const requestSchema = z.object({
  body: z.object({
    messages: z.array(
      z.object({
        role: z.string(),
        content: z.unknown().optional(),
        tool_call_id: z.string().optional(),
        tool_calls: z
          .array(z.object({ id: z.string(), function: z.object({ name: z.string(), arguments: z.string() }) }))
          .optional(),
      }),
    ),
  }),
});

let isRunning: () => boolean;

export const agentsMdAutoloadScenario: McE2eScenario = {
  name: 'agents-md-autoload',
  description:
    'Load package instructions once, show their paths, and discover another package in the same TUI session.',
  testName: 'injects directory instructions into the next model request and renders each loaded path only once',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  disableMemory: false,
  aimockFixture: 'agents-md-autoload.json',
  prepare({ projectDir }) {
    for (const [name, sentinel] of [
      ['core', CORE_SENTINEL],
      ['deployer', DEPLOYER_SENTINEL],
    ] as const) {
      const directory = join(projectDir, 'packages', name);
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, 'AGENTS.md'), `${sentinel}\n`);
      writeFileSync(join(directory, 'package.json'), JSON.stringify({ name: `fixture-${name}` }));
    }
  },
  async inProcessApp({ startMastraCodeApp }) {
    return startMastraCodeApp({
      onCreated({ session }) {
        isRunning = () => session.stream.isActive();
      },
    });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })).toBeVisible();

    const turns = [
      { prompt: 'List packages/core/.', response: /Core directory listing complete\./, core: 1, deployer: 0 },
      { prompt: 'Read packages/core/package.json.', response: /Core file read complete\./, core: 1, deployer: 0 },
      {
        prompt: 'Read packages/deployer/package.json.',
        response: /Deployer file read complete\./,
        core: 1,
        deployer: 1,
      },
    ];
    for (const turn of turns) {
      terminal.submit(turn.prompt);
      await runtime.waitForScreenText(turn.response, terminal);
      // A response delta alone isn't completion: wait for the real session to become idle.
      const deadline = Date.now() + 10_000;
      while (isRunning() && Date.now() < deadline) await runtime.sleep(50);
      assert.equal(isRunning(), false, `Session did not finish: ${turn.prompt}`);
      await terminal.flushInput?.();
      if (!terminal.serializeHistory) throw new Error('Instruction dedup assertions require full terminal scrollback');
      const transcript = terminal.serializeHistory().output;
      assert.equal((transcript.match(CORE_LOADED) ?? []).length, turn.core, `Core load notifications:\n${transcript}`);
      assert.equal(
        (transcript.match(DEPLOYER_LOADED) ?? []).length,
        turn.deployer,
        `Deployer load notifications:\n${transcript}`,
      );
      runtime.printScreen(turn.prompt, terminal);
    }
  },
  verifyAimockRequests(requests) {
    const messages = requests.map(request => requestSchema.parse(request).body.messages);
    expect(messages).toHaveLength(6);
    const expectedCounts = [
      [0, 0], // Nothing loaded before the first directory tool completes.
      [1, 0], // Directory instructions reach the immediate next request.
      [1, 0],
      [1, 0], // Reading another core file must not add another instruction copy.
      [1, 0],
      [1, 1], // Core coverage must not hide deployer discovery.
    ];
    messages.forEach((requestMessages, index) => {
      const content = JSON.stringify(requestMessages);
      assert.equal(content.split(CORE_SENTINEL).length - 1, expectedCounts[index]![0], `Core in request ${index}`);
      assert.equal(
        content.split(DEPLOYER_SENTINEL).length - 1,
        expectedCounts[index]![1],
        `Deployer in request ${index}`,
      );
    });
    for (const [index, name, path, id] of [
      [1, 'find_files', 'packages/core/', 'call_directory_core'],
      [3, 'view', 'packages/core/package.json', 'call_file_core'],
      [5, 'view', 'packages/deployer/package.json', 'call_file_deployer'],
    ] as const) {
      const requestMessages = messages[index]!;
      const call = requestMessages.flatMap(message => message.tool_calls ?? []).find(tool => tool.id === id);
      assert.ok(call, `Missing completed tool call ${id}`);
      assert.equal(call.function.name, name);
      assert.equal(JSON.parse(call.function.arguments).path, path);
      const result = requestMessages.find(message => message.role === 'tool' && message.tool_call_id === id);
      assert.ok(result, `Missing tool result ${id}`);
      expect(JSON.stringify(result?.content)).toContain(
        index === 1 ? 'AGENTS.md' : `fixture-${index === 3 ? 'core' : 'deployer'}`,
      );
    }
  },
};
