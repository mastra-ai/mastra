import { it, expect } from 'vitest';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: includeRawChunks.
 *
 * With includeRawChunks the provider's raw SSE payloads reach the full stream
 * as `raw` chunks; without it no `raw` chunk is emitted.
 */
describeForAllEngines('AIMock loop scenario: raw chunks', engine => {
  const getMock = useLoopScenarioAimock();

  const run = (includeRawChunks: boolean) =>
    runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Say hello.',
      collectChunks: true,
      includeRawChunks,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Hello, world!', id: 'chatcmpl-raw' });
      },
    });

  // Durable and evented engines currently drop raw chunks on the way to the client.
  it.runIf(engine === 'normal' || engine === 'fs')(
    'forwards provider raw chunks when includeRawChunks is enabled',
    async () => {
      const { chunks, output } = await run(true);
      const raw = chunks.filter((c: any) => c.type === 'raw');
      expect(raw.length).toBeGreaterThan(0);
      expect(JSON.stringify(raw.map((c: any) => c.payload))).toContain('chatcmpl-raw');
      expect(await output.text).toBe('Hello, world!');
    },
  );

  it('emits no raw chunks when includeRawChunks is disabled', async () => {
    const { chunks, output } = await run(false);
    expect(chunks.filter((c: any) => c.type === 'raw')).toHaveLength(0);
    expect(await output.text).toBe('Hello, world!');
  });
});
