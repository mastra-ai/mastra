import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { stepCountIs } from '@internal/ai-v7';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: provider sources and model-generated files.
 *
 * Citations served as OpenAI Responses `url_citation` annotations must reach
 * `output.sources` and the `source` stream chunks. Images served as Gemini
 * `inlineData` parts must reach `output.files` and the `file` stream chunks
 * with their bytes intact.
 */
// Fixture `citations` / `files` land in aimock via CopilotKit/aimock#550. Until a release with
// them is pinned in package.json, run only when the installed aimock emits url_citation.
const aimockDist = dirname(createRequire(import.meta.url).resolve('@copilotkit/aimock'));
const aimockSupportsCitations = readFileSync(join(aimockDist, 'responses.js'), 'utf8').includes('url_citation');

describe.runIf(aimockSupportsCitations)('aimock with fixture citations/files', () => {
  describeForAllEngines('AIMock loop scenario: sources and files', engine => {
    const getMock = useLoopScenarioAimock();

    it('surfaces Responses API citations as sources', async () => {
      const llm = getMock();
      const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });

      const { output, chunks } = await runLoopScenario({
        engine,
        llm,
        model: () => openai.responses('gpt-4o-mini'),
        prompt: 'What is Mastra?',
        stopWhen: stepCountIs(1),
        collectChunks: true,
        fixtures: mock => {
          mock.on(
            { userMessage: 'What is Mastra?' },
            {
              content: 'Mastra is a TypeScript agent framework.',
              citations: [
                { url: 'https://mastra.ai', title: 'Mastra' },
                { url: 'https://mastra.ai/docs', title: 'Docs', startIndex: 0, endIndex: 6 },
              ],
            },
          );
        },
      });

      expect(await output.text).toBe('Mastra is a TypeScript agent framework.');
      const sources = await output.sources;
      expect(sources.map(s => [s.payload.sourceType, s.payload.url, s.payload.title])).toEqual([
        ['url', 'https://mastra.ai', 'Mastra'],
        ['url', 'https://mastra.ai/docs', 'Docs'],
      ]);
      expect(chunks!.filter(c => c.type === 'source')).toHaveLength(2);
    });

    it('surfaces Gemini inline images as files', async () => {
      const llm = getMock();
      const google = createGoogleGenerativeAI({
        apiKey: 'aimock-test-key',
        baseURL: `${llm.url.replace(/\/+$/, '')}/v1beta`,
      });
      const png = Buffer.from('fake-png-bytes').toString('base64');

      const { output, chunks } = await runLoopScenario({
        engine,
        llm,
        model: () => google('gemini-2.0-flash'),
        prompt: 'Draw a cat.',
        stopWhen: stepCountIs(1),
        collectChunks: true,
        fixtures: mock => {
          mock.on(
            { userMessage: 'Draw a cat.' },
            { content: 'Here is your cat.', files: [{ mimeType: 'image/png', data: png }] },
          );
        },
      });

      expect(await output.text).toBe('Here is your cat.');
      const files = await output.files;
      expect(files).toHaveLength(1);
      expect(files[0].payload.mimeType).toBe('image/png');
      const data = files[0].payload.data;
      expect(typeof data === 'string' ? data : Buffer.from(data).toString('base64')).toBe(png);
      expect(chunks!.filter(c => c.type === 'file')).toHaveLength(1);
    });
  });
});
