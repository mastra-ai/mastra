import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import { WORKSPACE_TOOLS } from '../../../../workspace/constants';
import { LocalSandbox } from '../../../../workspace/sandbox';
import { Workspace } from '../../../../workspace/workspace';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';
import type { RunLoopScenarioOptions } from '../types';

/**
 * Regression class: with `backgroundProcesses.notifyAgent`, a background command
 * started by `execute_command` reports its exit to the agent's thread, so the
 * agent can tell the user how it went after its turn ended. A process the user
 * or agent killed on purpose is not reported.
 */

const EXECUTE_COMMAND = WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND;

// Waits for a `go` file so the command exits after the turn that started it has ended.
// `node -e` instead of shell syntax so it runs under both sh and cmd.exe.
const gatedCommand = (output: string, exitCode: number) =>
  `node -e "const fs=require('fs');const t=setInterval(()=>{if(fs.existsSync('go')){clearInterval(t);console.log('${output}');process.exit(${exitCode})}},20)"`;

function requestsFor(llm: { getRequests: () => Array<{ body: unknown }> }, prompt: string) {
  return llm
    .getRequests()
    .filter(r => (r.body as any)?.messages?.some((m: any) => m.role === 'user' && m.content === prompt));
}

const mentions = (req: unknown, text: string) => JSON.stringify(req).includes(text);
const hasToolResult = (req: unknown) => ((req as any)?.messages ?? []).some((m: any) => m.role === 'tool');

describeForAllEngines('AIMock loop scenario: background process exit notices', engine => {
  const getMock = useLoopScenarioAimock();
  let dir: string;
  let workspace: Workspace;
  let abort: AbortController;

  beforeEach(async () => {
    abort = new AbortController();
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aimock-bg-process-'));
    workspace = new Workspace({
      sandbox: new LocalSandbox({ workingDirectory: dir }),
      tools: { [EXECUTE_COMMAND]: { backgroundProcesses: { notifyAgent: true } } },
    });
  });

  afterEach(async () => {
    await workspace.destroy();
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  });

  async function startInBackground(
    threadId: string,
    prompt: string,
    command: string,
    report: string,
    defaultOptions?: RunLoopScenarioOptions['defaultOptions'],
  ) {
    const memory = new MockMemory();
    const thread = { threadId, resourceId: 'bg-process-user' };
    const { llm } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt,
      workspace,
      memory,
      ...thread,
      ...(defaultOptions ? { defaultOptions } : {}),
      stopWhen: stepCountIs(3),
      fixtures: mock => {
        mock.on(
          { endpoint: 'chat', predicate: (req: unknown) => mentions(req, prompt) && !hasToolResult(req) },
          { toolCalls: [{ id: 'call-bg-1', name: EXECUTE_COMMAND, arguments: { command, background: true } }] },
        );
        mock.on(
          {
            endpoint: 'chat',
            predicate: (req: unknown) =>
              mentions(req, prompt) && hasToolResult(req) && !mentions(req, 'exited with code'),
          },
          { content: 'Started it in the background.' },
        );
        mock.on(
          { endpoint: 'chat', predicate: (req: unknown) => mentions(req, prompt) && mentions(req, 'exited with code') },
          { content: report },
        );
      },
    });
    const storedText = async () => JSON.stringify((await memory.recall(thread)).messages);
    return { llm, storedText };
  }

  it('wakes the agent with the exit code and output of a background command that finishes after the turn', async () => {
    const prompt = 'Run the test suite in the background';
    const exits: string[] = [];
    // A host's onExit that never settles must not hold back the agent's notice.
    workspace.setToolsConfig({
      [EXECUTE_COMMAND]: {
        backgroundProcesses: {
          notifyAgent: true,
          onExit: ({ pid }) => {
            exits.push(pid);
            return new Promise<void>(() => {});
          },
        },
      },
    });
    const { llm, storedText } = await startInBackground(
      'bg-process-tests',
      prompt,
      gatedCommand('tests passed: 12, failed: 1', 3),
      'The test run finished: 1 test failed.',
    );
    expect(requestsFor(llm, prompt)).toHaveLength(2);

    await fs.writeFile(path.join(dir, 'go'), '');

    await vi.waitFor(async () => expect(await storedText()).toContain('The test run finished: 1 test failed.'), {
      timeout: 15_000,
      interval: 50,
    });
    const requests = requestsFor(llm, prompt);
    expect(requests).toHaveLength(3);
    const notice = JSON.stringify(requests[2]!.body);
    expect(notice).toContain('exited with code 3');
    expect(notice).toContain('tests passed: 12, failed: 1');
    expect(exits).toHaveLength(1);
  }, 30_000);

  it('leaves the command and output out of the notice when the agent rewrites tool payloads for the transcript', async () => {
    const prompt = 'Run the secret job in the background';
    const { llm, storedText } = await startInBackground(
      'bg-process-transcript',
      prompt,
      gatedCommand('secret-token-123', 0),
      'The job finished.',
      { transform: { targets: ['transcript'], transformToolPayload: () => '[redacted]' } },
    );

    await fs.writeFile(path.join(dir, 'go'), '');

    await vi.waitFor(async () => expect(await storedText()).toContain('The job finished.'), {
      timeout: 15_000,
      interval: 50,
    });
    const notice = JSON.stringify(requestsFor(llm, prompt)[2]!.body);
    expect(await storedText()).not.toContain('secret-token-123');
    expect(notice).not.toContain('secret-token-123');
    expect(notice).toContain('exited with code 0.');
    expect(notice).toContain('get_process_output');
  }, 30_000);

  it.each([
    {
      how: 'killed through the process manager',
      // The same kill the `kill_process` tool and the HTTP kill route use.
      stop: async (pid: string) => expect(await workspace.sandbox!.processes!.kill(pid)).toBe(true),
    },
    { how: 'killed by its abort signal', stop: async () => abort.abort() },
  ])(
    'does not wake the agent for a background command $how',
    async ({ how, stop }) => {
      const prompt = `Start the dev server in the background (${how})`;
      const exits: string[] = [];
      workspace.setToolsConfig({
        [EXECUTE_COMMAND]: {
          backgroundProcesses: {
            notifyAgent: true,
            abortSignal: abort.signal,
            onExit: ({ pid }) => void exits.push(pid),
          },
        },
      });
      const { llm } = await startInBackground(
        `bg-process-${how.replaceAll(' ', '-')}`,
        prompt,
        gatedCommand('server stopped', 0),
        'The server exited.',
      );
      const [server] = await workspace.sandbox!.processes!.list();

      await stop(server!.pid);
      await vi.waitFor(() => expect(exits).toEqual([server!.pid]), { timeout: 5_000 });
      // A notice would reach the model within this window (the waking test sees it well within it).
      await new Promise(resolve => setTimeout(resolve, 1_000));

      expect(requestsFor(llm, prompt)).toHaveLength(2);
    },
    30_000,
  );
});
