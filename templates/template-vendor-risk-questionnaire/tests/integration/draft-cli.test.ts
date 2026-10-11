import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { draftingFixture } from '../support/drafting.ts';
import { temporaryDirectory, cleanupDirectory } from '../fixtures/support.ts';

const execute = promisify(execFile);
const entry = resolve('scripts/draft.ts');
let root: string;
beforeEach(async () => {
  root = await temporaryDirectory();
});
afterEach(async () => {
  await cleanupDirectory(root);
});

describe('native Node draft CLI', () => {
  it('starts_and_reopens_real_draft_entry_point_with_safe_offline_authentication_result', async () => {
    await mkdir(resolve(root, '.runtime'));
    const fixture = await draftingFixture(root, { databasePath: resolve(root, '.runtime', 'vrq.db') });
    // Native Node strips types without Vitest transforms; never load an environment file or provider credential.
    const options = {
      cwd: root,
      env: { ...process.env, OPENAI_API_KEY: undefined, MASTRA_TELEMETRY_DISABLED: '1' },
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    };
    const started = await execute(
      process.execPath,
      [
        entry,
        'start',
        '--run-id',
        fixture.runId,
        '--manifest',
        fixture.manifestPath,
        '--root',
        resolve(root, 'evidence'),
      ],
      options,
    ).then(
      result => ({ ...result, code: 0 }),
      (error: { code: number; stdout: string; stderr: string }) => error,
    );
    expect(started.code).toBe(1);
    expect(JSON.parse(started.stdout)).toMatchObject({
      runId: fixture.runId,
      workflowStatus: 'success',
      state: 'failed',
      stopReason: 'AUTHENTICATION_FAILURE',
    });
    const reopened = await execute(process.execPath, [entry, 'status', '--run-id', fixture.runId], options);
    const status = JSON.parse(reopened.stdout);
    expect(status).toMatchObject({
      runId: fixture.runId,
      state: 'failed',
      stopReason: 'AUTHENTICATION_FAILURE',
      physicalCalls: 0,
      estimatedUsd: 0,
      results: [
        { questionId: fixture.questions[0]!.id, status: 'review_required', reasons: ['AUTHENTICATION_FAILURE'] },
      ],
    });
    expect(started.stderr + reopened.stderr).not.toContain('ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX');
    expect(started.stdout + reopened.stdout + started.stderr + reopened.stderr).not.toContain(
      fixture.questions[0]!.originalText,
    );
  });
});
