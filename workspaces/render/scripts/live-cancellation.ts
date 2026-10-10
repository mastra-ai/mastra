import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Workspace, createWorkspaceTools } from '@mastra/core/workspace';
import { Render } from '@renderinc/sdk';
import { RenderSandbox } from '@mastra/render';
import { confirmTermination } from './cleanup.js';

const client = new Render();
const dir = resolve(process.env.EVIDENCE_DIR ?? 'validation/cancellation-artifacts');
await mkdir(dir, { recursive: true });
const record: { startedAt: string; cases: Record<string, unknown>[] } = {
  startedAt: new Date().toISOString(),
  cases: [],
};
const save = () => writeFile(resolve(dir, 'cancellation.json'), JSON.stringify(record, null, 2) + '\n');
for (const attached of [true, false]) {
  const owner = new RenderSandbox({
    client,
    create: { timeoutSeconds: 180, networkPolicy: { default: 'deny-all' } },
  });
  const item: Record<string, unknown> = { attached };
  record.cases.push(item);
  let workspace: Workspace | undefined;
  try {
    await owner.start();
    item.sandboxId = owner.sandboxId;
    await save();
    const sandbox = attached ? new RenderSandbox({ client, sandboxId: owner.sandboxId }) : owner;
    workspace = new Workspace({ sandbox });
    await workspace.init();
    const tools = await createWorkspaceTools(workspace);
    const abort = new AbortController();
    const watchdog = setTimeout(() => abort.abort(), 30_000);
    try {
      item.toolOutput = await tools.mastra_workspace_execute_command.execute(
        { command: 'printf started; sleep 2; printf survived > /tmp/cancellation-survived' },
        {
          abortSignal: abort.signal,
          writer: {
            custom: async (event: { type: string }) => {
              if (event.type === 'data-sandbox-stdout') abort.abort();
            },
          },
        },
      );
    } finally {
      clearTimeout(watchdog);
    }
    assert(abort.signal.aborted);
    if (attached) {
      assert.match(String(item.toolOutput), /Remote work may still be running/);
      item.statusAfterAbort = (await client.experimental.sandboxes.get(owner.sandboxId!)).status;
      assert.equal(item.statusAfterAbort, 'running');
      const result = await owner.executeCommand('sleep 3; cat /tmp/cancellation-survived');
      assert.equal(result.stdout, 'survived');
      assert.equal(result.exitCode, 0);
      item.remoteCommandContinued = true;
      item.toolIncorrectlyClaimsKilled = /so it was killed/.test(String(item.toolOutput));
    } else {
      item.terminationAfterAbort = await confirmTermination(client, owner.sandboxId!);
    }
    item.passed = true;
  } finally {
    try {
      await workspace?.destroy();
      await owner.destroy();
      if (owner.sandboxId) item.cleanup = await confirmTermination(client, owner.sandboxId);
    } finally {
      await save();
    }
  }
}
console.log(JSON.stringify(record, null, 2));
