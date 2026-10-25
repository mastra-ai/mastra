/**
 * End-to-end check for #25219: an agent that reads an image asset through
 * `skill_read` must hand the model the image bytes as a native media part,
 * not a "Binary file" placeholder.
 */
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LocalFilesystem } from '../../workspace/filesystem';
import { Workspace } from '../../workspace/workspace';
import { Agent } from '../index';

// 1x1 transparent PNG
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=';

describe('skill_read media through an agent (#25219)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-skill-read-media-'));
    const skillDir = path.join(tempDir, 'skills', 'design-system');
    await fs.mkdir(path.join(skillDir, 'assets'), { recursive: true });
    await fs.writeFile(
      path.join(skillDir, 'SKILL.md'),
      '---\nname: design-system\ndescription: Brand assets\n---\n\n# Design system',
    );
    await fs.writeFile(path.join(skillDir, 'assets', 'logo.png'), Buffer.from(PNG_BASE64, 'base64'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('passes a skill PNG asset to the model as a media part', async () => {
    const prompts: any[] = [];
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        prompts.push(prompt);
        const first = prompts.length === 1;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: `id-${prompts.length}`, modelId: 'mock', timestamp: new Date(0) },
            ...(first
              ? [
                  {
                    type: 'tool-call' as const,
                    toolCallId: 'call-1',
                    toolName: 'skill_read',
                    input: JSON.stringify({ skillName: 'design-system', path: 'assets/logo.png' }),
                  },
                ]
              : [
                  { type: 'text-start' as const, id: 't' },
                  { type: 'text-delta' as const, id: 't', delta: 'A logo.' },
                  { type: 'text-end' as const, id: 't' },
                ]),
            {
              type: 'finish',
              finishReason: first ? 'tool-calls' : 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            },
          ]),
        };
      },
    });

    const agent = new Agent({
      id: 'skill-media-agent',
      name: 'skill-media-agent',
      instructions: 'Use skills.',
      model,
      workspace: new Workspace({
        id: 'skill-media-ws',
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        skills: ['skills'],
      }),
    });

    const result = await agent.stream('Read assets/logo.png from the design-system skill.', { maxSteps: 2 });
    await result.consumeStream();

    expect(prompts).toHaveLength(2);
    const toolMessage = prompts[1].find((message: any) => message.role === 'tool');
    expect(toolMessage?.content).toEqual([
      expect.objectContaining({
        type: 'tool-result',
        toolName: 'skill_read',
        output: {
          type: 'content',
          value: [
            { type: 'text', text: expect.stringContaining('assets/logo.png') },
            { type: 'media', mediaType: 'image/png', data: PNG_BASE64 },
          ],
        },
      }),
    ]);
  });
});
