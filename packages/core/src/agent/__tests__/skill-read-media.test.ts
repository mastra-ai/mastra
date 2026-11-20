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
// 1x1 lossless WebP
const WEBP_BASE64 = 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
// What a failed download saves under a .pdf name
const HTML_ERROR_PAGE = '<!doctype html><html><body><h1>404 Not Found</h1></body></html>';

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
    // A WebP screenshot saved with a .png name.
    await fs.writeFile(path.join(skillDir, 'assets', 'screenshot.png'), Buffer.from(WEBP_BASE64, 'base64'));
    await fs.writeFile(path.join(skillDir, 'assets', 'manual.pdf'), HTML_ERROR_PAGE);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function readSkillAssetThroughAgent(assetPath: string) {
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
                    input: JSON.stringify({ skillName: 'design-system', path: assetPath }),
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

    const result = await agent.stream(`Read ${assetPath} from the design-system skill.`, { maxSteps: 2 });
    await result.consumeStream();

    expect(prompts).toHaveLength(2);
    const toolMessage = prompts[1].find((message: any) => message.role === 'tool');
    expect(toolMessage?.content).toHaveLength(1);
    return toolMessage.content[0];
  }

  it('passes a skill PNG asset to the model as a media part', async () => {
    expect(await readSkillAssetThroughAgent('assets/logo.png')).toMatchObject({
      type: 'tool-result',
      toolName: 'skill_read',
      output: {
        type: 'content',
        value: [
          { type: 'text', text: expect.stringContaining('assets/logo.png') },
          { type: 'media', mediaType: 'image/png', data: PNG_BASE64 },
        ],
      },
    });
  });

  // A part declared under the wrong type is rejected by the provider, and the stored result
  // then fails every later call in the run, so the bytes decide the type, as in read_file.
  it('sends a WebP saved as .png as image/webp, not image/png', async () => {
    expect(await readSkillAssetThroughAgent('assets/screenshot.png')).toMatchObject({
      output: {
        type: 'content',
        value: [
          { type: 'text', text: expect.stringContaining('image/webp') },
          { type: 'media', mediaType: 'image/webp', data: WEBP_BASE64 },
        ],
      },
    });
  });

  it('shows an HTML page saved as .pdf as text instead of sending it as a PDF', async () => {
    const result = await readSkillAssetThroughAgent('assets/manual.pdf');
    expect(JSON.stringify(result.output)).not.toContain('"media"');
    expect(result.output).toEqual({
      type: 'text',
      value: expect.stringContaining(HTML_ERROR_PAGE),
    });
    expect(result.output.value).toContain('the extension says application/pdf');
  });
});
