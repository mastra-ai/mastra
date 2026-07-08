import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  enrichSubmitPlanMessages,
  enrichSubmitPlanStreamChunk,
  enrichSubmitPlanSuspendPayload,
} from './submit-plan-enrichment';

describe('submit plan enrichment', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-submit-plan-'));
    await fs.mkdir(path.join(projectRoot, '.mastracode', 'plans'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it('leaves malformed payloads unchanged', async () => {
    await expect(enrichSubmitPlanSuspendPayload(undefined, { projectRoot })).resolves.toBeUndefined();
    await expect(enrichSubmitPlanSuspendPayload({ title: 'No path' }, { projectRoot })).resolves.toEqual({
      title: 'No path',
    });
  });

  it('leaves unsafe plan paths unchanged', async () => {
    const outsidePath = '../plans/escape.md';
    const nestedPath = '.mastracode/plans/nested/plan.md';
    const nonMarkdownPath = '.mastracode/plans/plan.txt';

    await expect(enrichSubmitPlanSuspendPayload({ path: outsidePath }, { projectRoot })).resolves.toEqual({
      path: outsidePath,
    });
    await expect(enrichSubmitPlanSuspendPayload({ path: nestedPath }, { projectRoot })).resolves.toEqual({
      path: nestedPath,
    });
    await expect(enrichSubmitPlanSuspendPayload({ path: nonMarkdownPath }, { projectRoot })).resolves.toEqual({
      path: nonMarkdownPath,
    });
  });

  it('reads markdown content from direct local plan files', async () => {
    await fs.writeFile(
      path.join(projectRoot, '.mastracode', 'plans', 'cook-anything.md'),
      '# Cook Anything\n\n## Summary\n\nMake dinner.',
      'utf-8',
    );

    await expect(
      enrichSubmitPlanSuspendPayload({ path: '.mastracode/plans/cook-anything.md' }, { projectRoot }),
    ).resolves.toEqual({
      path: '.mastracode/plans/cook-anything.md',
      title: 'Cook Anything',
      plan: '## Summary\n\nMake dinner.',
    });
  });

  it('enriches submit_plan suspended stream chunks', async () => {
    await fs.writeFile(
      path.join(projectRoot, '.mastracode', 'plans', 'stream-plan.md'),
      '# Stream Plan\n\nReview this plan.',
      'utf-8',
    );

    await expect(
      enrichSubmitPlanStreamChunk(
        {
          type: 'tool-call-suspended',
          payload: {
            toolName: 'submit_plan',
            toolCallId: 'call-1',
            suspendPayload: { path: '.mastracode/plans/stream-plan.md' },
          },
        },
        { projectRoot },
      ),
    ).resolves.toMatchObject({
      payload: {
        suspendPayload: {
          path: '.mastracode/plans/stream-plan.md',
          title: 'Stream Plan',
          plan: 'Review this plan.',
        },
      },
    });
  });

  it('enriches submit_plan metadata in stored messages', async () => {
    await fs.writeFile(
      path.join(projectRoot, '.mastracode', 'plans', 'stored-plan.md'),
      '# Stored Plan\n\nStored body.',
      'utf-8',
    );

    const [message] = await enrichSubmitPlanMessages(
      [
        {
          id: 'message-1',
          content: {
            metadata: {
              suspendedTools: {
                'call-1': {
                  toolName: 'submit_plan',
                  toolCallId: 'call-1',
                  suspendPayload: { path: '.mastracode/plans/stored-plan.md' },
                },
              },
            },
          },
        },
      ],
      { projectRoot },
    );

    expect(message).toMatchObject({
      content: {
        metadata: {
          suspendedTools: {
            'call-1': {
              suspendPayload: {
                path: '.mastracode/plans/stored-plan.md',
                title: 'Stored Plan',
                plan: 'Stored body.',
              },
            },
          },
        },
      },
    });
  });
});
