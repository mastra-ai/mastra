import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { Daytona, DaytonaNotFoundError, DaytonaGoneError, SandboxState } from '@daytonaio/sdk';
const path = '../daytona-cancellation-live.json';
const record = JSON.parse(await readFile(path, 'utf8'));
const audit = new Daytona({ otelEnabled: false });
const observations = [];
let verified = false;
try {
  for (let attempt = 0; attempt < 30; attempt++) {
    let state;
    try {
      const current = await audit.get(record.sandboxId);
      state = current.state;
      if (state !== SandboxState.DESTROYED && state !== SandboxState.DESTROYING) {
        await audit.delete(current, 30, true);
      }
    } catch (error) {
      if (!(error instanceof DaytonaNotFoundError) && !(error instanceof DaytonaGoneError)) throw error;
      state = error.name;
    }
    const matching = [];
    for await (const sandbox of audit.list({ labels: { 'mastra-sandbox-id': record.name } })) {
      matching.push({ id: sandbox.id, state: sandbox.state });
    }
    const item = { at: new Date().toISOString(), lookup: state, matching };
    observations.push(item);
    console.log(JSON.stringify(item));
    const terminal = state === SandboxState.DESTROYED || ['DaytonaNotFoundError', 'DaytonaGoneError'].includes(state);
    if (terminal && matching.every(s => s.state === SandboxState.DESTROYED)) {
      verified = true;
      break;
    }
    await delay(2000);
  }
  assert.equal(verified, true, 'Both independent cleanup checks must confirm deletion');
  record.initialCleanupVerification = record.cleanup;
  record.cleanup = {
    deleted: true,
    sandboxId: record.sandboxId,
    verification:
      'Fresh independent SDK client: lookup returned terminal state/not-found and label-filtered list contained no active resource',
    observations,
    verifiedAt: new Date().toISOString(),
  };
  await writeFile(path, JSON.stringify(record, null, 2) + '\n');
} catch (error) {
  console.error(`${error.name}: ${error.message}`.replaceAll(process.env.DAYTONA_API_KEY, '[REDACTED]'));
  process.exitCode = 1;
} finally {
  await audit[Symbol.asyncDispose]();
}
