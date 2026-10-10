import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { Render } from '@renderinc/sdk';
import { RenderSandbox } from '@mastra/render';
import { confirmTermination } from '../../scripts/cleanup.js';

const fixture = new URL('./fixture/', import.meta.url);
export const taskPrompt =
  'Fix /workspace/total.mjs so it includes every amount from orders.csv. ' +
  'Read the files and run node --test test_total.mjs. Create /workspace/outputs/report.json by redirecting node total.mjs orders.csv into it. ' +
  'The report must contain exactly two keys: total (number) and row_count (number). Do not put test results or commentary in that JSON file. ' +
  'Do not modify orders.csv or test_total.mjs. Use the workspace shell tool to do the work. Report the test result.';

export async function runExample(client = new Render()) {
  const sandbox = new RenderSandbox({
    client,
    workingDirectory: '/workspace',
    create: { timeoutSeconds: 900, networkPolicy: { default: 'deny-all' } },
    commandTimeoutMs: 60_000,
  });
  const workspace = new Workspace({ sandbox });
  const model = process.env.MODEL ?? 'anthropic/claude-haiku-4-5-20251001';
  const evidence: Record<string, unknown> = { model, startedAt: new Date().toISOString(), statuses: [] };
  const statuses = evidence.statuses as string[];
  const destination = resolve(process.env.EVIDENCE_DIR ?? 'validation/latest-artifacts');
  await mkdir(destination, { recursive: true });
  const save = () => writeFile(resolve(destination, 'result.json'), JSON.stringify(evidence, null, 2) + '\n');
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 240_000);
  const interrupt = () => abort.abort();
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  try {
    await workspace.init();
    evidence.sandboxId = sandbox.sandboxId;
    statuses.push(sandbox.status);
    await save();
    console.log(`Sandbox ${sandbox.sandboxId}: ${sandbox.status}`);
    const names = ['total.mjs', 'orders.csv', 'test_total.mjs'];
    await sandbox.writeFiles(
      await Promise.all(
        names.map(async name => ({
          path: `/workspace/${name}`,
          content: await readFile(new URL(name, fixture)),
        })),
      ),
    );
    // Establish that the task needs a real repair rather than a success-shaped model answer.
    const baseline = await sandbox.executeCommand('node --test test_total.mjs');
    assert.notEqual(baseline.exitCode, 0);
    evidence.baselineExitCode = baseline.exitCode;
    const agent = new Agent({
      id: 'csv-repair',
      name: 'CSV repair agent',
      model,
      instructions:
        'Repair code using the workspace shell tool. Verify the result with tests. Files are in /workspace. Do not install dependencies or use the network.',
      workspace,
    });
    const response = await agent.generate(taskPrompt, { maxSteps: 12, abortSignal: abort.signal });
    evidence.providerResponses = response.steps.map(step => ({
      id: step.response.id,
      modelId: step.response.modelId,
      timestamp: step.response.timestamp,
    }));
    evidence.totalUsage = response.totalUsage;
    evidence.agentText = response.text;
    evidence.toolCalls = response.toolCalls.map(call => ({ toolName: call.payload.toolName }));
    assert(response.toolCalls.length > 0, 'The model must actually use a workspace tool');
    // Restore the host-owned tests and input before independent verification.
    await sandbox.writeFiles(
      await Promise.all(
        ['orders.csv', 'test_total.mjs', 'verify.mjs'].map(async name => ({
          path: `/workspace/${name}`,
          content: await readFile(new URL(name, fixture)),
        })),
      ),
    );
    const verified = await sandbox.executeCommand('node --test test_total.mjs && node verify.mjs');
    assert.equal(verified.exitCode, 0, verified.stderr);
    assert.match(verified.stdout, /pass 4/);
    assert.match(verified.stdout, /Verified report: total=42, row_count=3/);
    const report = await sandbox.readFile('/workspace/outputs/report.json');
    const corrected = await sandbox.readFile('/workspace/total.mjs');
    assert.deepEqual(JSON.parse(report.toString()), { total: 42, row_count: 3 });
    assert.notEqual(corrected.toString(), await readFile(new URL('total.mjs', fixture), 'utf8'));
    await writeFile(resolve(destination, 'report.json'), report);
    await writeFile(resolve(destination, 'total.mjs'), corrected);
    Object.assign(evidence, {
      verifiedStdout: verified.stdout,
      report: JSON.parse(report.toString()),
      testsPassed: 4,
      taskPassed: true,
    });
    console.log('Verified report: total=42, row_count=3; 4 original tests passed');
  } catch (error) {
    evidence.taskPassed = false;
    evidence.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    throw error;
  } finally {
    clearTimeout(timer);
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);
    // Cleanup failure deliberately fails the example and retains the ID in the record.
    try {
      await workspace.destroy();
      if (sandbox.sandboxId) {
        evidence.sandboxId = sandbox.sandboxId;
        evidence.cleanup = await confirmTermination(client, sandbox.sandboxId);
        statuses.push('terminated');
        console.log(`Sandbox ${sandbox.sandboxId}: termination confirmed`);
      }
    } catch (error) {
      evidence.cleanupError = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      await save();
    }
  }
  return evidence;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runExample();
}
