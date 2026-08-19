import { describe, expect, it } from 'vitest';

import { runPiToolCallHooks, runPiToolResultHooks } from '../hook-adapter.js';
import { MastraPiExtensionGeneration } from '../runtime.js';

function createGeneration(register: (api: ReturnType<MastraPiExtensionGeneration['createApi']>) => void) {
  const generation = new MastraPiExtensionGeneration('hook-plugin', 'hook-extension', '/tmp/hook.ts');
  register(generation.createApi());
  generation.bind();
  return generation;
}

describe('Pi tool hook adapter', () => {
  it('preserves registration order, in-place argument replacement, block, and terminate semantics', async () => {
    const seen: unknown[] = [];
    const generation = createGeneration(api => {
      api.on('tool_call', event => {
        const toolEvent = event as { input: Record<string, unknown> };
        toolEvent.input.value = 'first';
        seen.push(structuredClone(toolEvent.input));
      });
      api.on('tool_call', event => {
        const toolEvent = event as { input: Record<string, unknown> };
        toolEvent.input.second = true;
        seen.push(structuredClone(toolEvent.input));
        return { block: true, reason: 'denied', terminate: true };
      });
    });

    const result = await runPiToolCallHooks(
      generation,
      { type: 'tool_call', toolCallId: 'call-1', toolName: 'read', input: { value: 'initial' } },
      { cwd: '/workspace' },
    );

    expect(seen).toEqual([{ value: 'first' }, { value: 'first', second: true }]);
    expect(result).toEqual({
      input: { value: 'first', second: true },
      blocked: true,
      reason: 'denied',
      terminate: true,
    });
  });

  it('applies the last returned argument replacement', async () => {
    const generation = createGeneration(api => {
      api.on('tool_call', () => ({ input: { value: 'first' } }));
      api.on('tool_call', () => ({ input: { value: 'last' } }));
    });

    await expect(
      runPiToolCallHooks(
        generation,
        { type: 'tool_call', toolCallId: 'call-1', toolName: 'read', input: { value: 'initial' } },
        {},
      ),
    ).resolves.toEqual({ input: { value: 'last' }, blocked: false, reason: undefined, terminate: false });
  });

  it('chains tool-result transformations and preserves images, details, errors, and usage', async () => {
    const generation = createGeneration(api => {
      api.on('tool_result', () => ({
        content: [{ type: 'image', data: 'aGVsbG8=', mimeType: 'image/png' }],
        details: { first: true },
      }));
      api.on('tool_result', () => ({ isError: true, usage: { input: 1, output: 2 } }));
    });

    await expect(
      runPiToolResultHooks(
        generation,
        {
          type: 'tool_result',
          toolCallId: 'call-1',
          toolName: 'read',
          input: { path: 'a' },
          content: [{ type: 'text', text: 'old' }],
          isError: false,
        },
        { cwd: '/workspace' },
      ),
    ).resolves.toEqual({
      type: 'tool_result',
      toolCallId: 'call-1',
      toolName: 'read',
      input: { path: 'a' },
      content: [{ type: 'image', data: 'aGVsbG8=', mimeType: 'image/png' }],
      details: { first: true },
      isError: true,
      usage: { input: 1, output: 2 },
    });
  });

  it('attributes handler failures without blocking sibling runtime work', async () => {
    const generation = createGeneration(api =>
      api.on('tool_call', () => {
        throw new Error('hook exploded');
      }),
    );

    await expect(
      runPiToolCallHooks(
        generation,
        { type: 'tool_call', toolCallId: 'call-1', toolName: 'read', input: { value: 'unchanged' } },
        {},
      ),
    ).resolves.toEqual({ input: { value: 'unchanged' }, blocked: false, reason: undefined, terminate: false });
    expect(generation.compatibility.diagnostics).toEqual([
      expect.objectContaining({ extensionId: 'hook-extension', message: expect.stringContaining('hook exploded') }),
    ]);
  });

  it('rejects stale generations before invoking captured handlers', async () => {
    const generation = createGeneration(api => api.on('tool_call', () => undefined));
    await generation.invalidate();

    await expect(
      runPiToolCallHooks(generation, { type: 'tool_call', toolCallId: 'call-1', toolName: 'read', input: {} }, {}),
    ).rejects.toThrow('stale');
  });
});
