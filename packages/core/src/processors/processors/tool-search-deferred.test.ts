import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { noopLogger } from '../../logger';
import { RequestContext } from '../../request-context';
import { REQUEST_CONTEXT_INPUT_SOURCE } from '../../request-context/input-source';
import { createTool } from '../../tools';
import type { DeferredTool } from '../../tools';
import { CoreToolBuilder } from '../../tools/tool-builder/builder';
import type { ProcessInputStepArgs } from '../index';
import { ToolSearchProcessor } from './tool-search';

const step = (requestContext = new RequestContext(), tools = {}) =>
  ({
    requestContext,
    tools,
    messageList: { addSystem: vi.fn() },
  }) as unknown as ProcessInputStepArgs;
const executable = (id: string, owner = '') =>
  createTool({
    id,
    description: `${id} mailbox messages`,
    inputSchema: z.object({ limit: z.number().int().positive() }),
    execute: async () => owner,
  });
const metadata = (id: string, resolve = vi.fn(async () => executable(id))): DeferredTool => ({
  id,
  description: `${id} mailbox messages`,
  resolve,
});

describe('deferred tool search', () => {
  it.each(['equal-values', 'forged-symbol', 'forged-native-view', 'serialized', 'other-native-view'] as const)(
    'rejects a captured tool with an unrelated context: %s',
    async kind => {
      const alice = new RequestContext([['owner', 'alice']]);
      const execute = vi.fn(async () => 'done');
      const processor = new ToolSearchProcessor({
        tools: {},
        deferredTools: async () => ({
          mail: metadata(
            'mail',
            vi.fn(async () => createTool({ id: 'mail', description: 'mail', execute })),
          ),
        }),
      });
      const args = step(alice);
      const first = await processor.processInputStep(args);
      await first.tools.load_tool!.execute!({ toolName: 'mail' }, {} as never);
      const loaded = (await processor.processInputStep(args)).tools.mail;
      let unrelated = new RequestContext([['owner', 'alice']]);
      if (kind === 'forged-symbol' || kind === 'forged-native-view') {
        Object.defineProperty(unrelated, REQUEST_CONTEXT_INPUT_SOURCE, { value: alice });
        unrelated.set('requestContextExecutionSource', alice);
      }
      if (kind === 'forged-native-view') {
        const capture = createTool({
          id: 'capture',
          description: 'capture transformed context',
          requestContextSchema: z.object({ owner: z.string() }),
          execute: async (_input, context) => {
            unrelated = context!.requestContext!;
          },
        });
        await capture.execute!({}, { requestContext: unrelated } as never);
      }
      if (kind === 'serialized') unrelated = new RequestContext(Object.entries(JSON.parse(JSON.stringify(alice.all))));
      if (kind === 'other-native-view') {
        const bob = new RequestContext([['owner', 'bob']]);
        const capture = createTool({
          id: 'capture',
          description: 'capture context',
          inputSchema: z.object({}),
          execute: async (_input, context) => {
            unrelated = context!.requestContext!;
          },
        });
        await new CoreToolBuilder({
          originalTool: capture,
          options: { name: 'capture', logger: noopLogger, requestContext: bob },
        }).build().execute!({}, { toolCallId: 'capture', messages: [], requestContext: unrelated });
      }
      await expect(loaded.execute!({}, { requestContext: unrelated } as never)).rejects.toThrow(
        'request identity changed',
      );
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('accepts native merged and transformed views while transforming input once', async () => {
    const alice = new RequestContext([
      ['owner', 'alice'],
      ['count', '2'],
    ]);
    const execute = vi.fn(async (input: { limit: number }) => input);
    const resolve = vi.fn(async () =>
      createTool({
        id: 'mail',
        description: 'mail',
        inputSchema: z.object({ limit: z.number().transform(n => n + 1) }),
        execute,
      }),
    );
    const processor = new ToolSearchProcessor({
      tools: {},
      deferredTools: async () => ({ mail: metadata('mail', resolve) }),
    });
    const args = step(alice);
    const first = await processor.processInputStep(args);
    await first.tools.load_tool!.execute!({ toolName: 'mail' }, {} as never);
    const loaded = (await processor.processInputStep(args)).tools.mail;
    const forward = createTool({
      id: 'forward',
      description: 'forward native view',
      inputSchema: z.object({}),
      requestContextSchema: z.object({ count: z.string().transform(Number) }),
      execute: async (_input, context) => {
        expect(context!.requestContext!.get('count')).toBe(2);
        expect(context!.requestContext!.get('workflowOnly')).toBe(true);
        return loaded.execute!({ limit: 1 }, context as never);
      },
    });
    const built = new CoreToolBuilder({
      originalTool: forward,
      options: { name: 'forward', logger: noopLogger, requestContext: alice },
    }).build();
    await built.execute!(
      {},
      { toolCallId: 'forward', messages: [], requestContext: new RequestContext([['workflowOnly', true]]) },
    );
    expect(execute).toHaveBeenCalledExactlyOnceWith({ limit: 2 }, expect.anything());
    expect(resolve.mock.calls.length).toBeGreaterThan(1);
  });
  it('injects authorized metadata without resolving schemas when the catalog is requested', async () => {
    const resolve = vi.fn(async () => executable('mail'));
    const deferredTools = vi.fn(async () => ({ mail: metadata('mail', resolve), hidden: metadata('hidden') }));
    const processor = new ToolSearchProcessor({
      tools: {},
      deferredTools,
      injectCatalog: true,
      deferredFilter: ({ toolName }) => toolName !== 'hidden',
    });
    const args = step();
    await processor.processInputStep(args);
    expect(deferredTools).toHaveBeenCalledTimes(1);
    expect(resolve).not.toHaveBeenCalled();
    const instructions = vi
      .mocked(args.messageList.addSystem)
      .mock.calls.map(([text]) => text)
      .join('\n');
    expect(instructions).toContain('mail mailbox messages');
    expect(instructions).not.toContain('hidden');
  });
  it('preserves upstream eager auto-load filtering', async () => {
    const processor = new ToolSearchProcessor({
      tools: { mail: executable('mail') },
      search: { autoLoad: true },
      filter: ({ phase }) => phase !== 'load',
    });
    const args = step();
    const first = await processor.processInputStep(args);
    const found = await first.tools.search_tools.execute!({ query: 'mail' }, {} as never);
    expect(found).toMatchObject({ results: [{ name: 'mail' }] });
    expect((await processor.processInputStep(args)).tools.mail).toBeDefined();
  });
  it('does not read metadata or schemas for an unloaded text response', async () => {
    const resolve = vi.fn(async () => executable('mail'));
    const deferredTools = vi.fn(async () => ({ mail: metadata('mail', resolve) }));
    const processor = new ToolSearchProcessor({ tools: {}, deferredTools });
    const result = await processor.processInputStep(step());
    expect(Object.keys(result.tools)).toEqual(['search_tools', 'load_tool']);
    expect(deferredTools).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
  });

  it('searches the complete catalog and resolves only the selected tool', async () => {
    const schemaReads = vi.fn(async (id: string) => executable(id));
    const deferredTools = vi.fn(async () =>
      Object.fromEntries(
        Array.from({ length: 587 }, (_, i) => {
          const id = i === 586 ? 'unique_inbox' : `action_${i}`;
          return [
            id,
            metadata(
              id,
              vi.fn(() => schemaReads(id)),
            ),
          ];
        }),
      ),
    );
    const processor = new ToolSearchProcessor({ tools: {}, deferredTools, search: { topK: 1, autoLoad: true } });
    const args = step();
    const first = await processor.processInputStep(args);
    const found = await first.tools.search_tools.execute!({ query: 'unique_inbox' }, {} as never);
    expect(found).toMatchObject({ results: [{ name: 'unique_inbox' }] });
    expect(schemaReads.mock.calls.map(([id]) => id)).toEqual(['unique_inbox']);
    const second = await processor.processInputStep(args);
    expect(Object.keys(second.tools)).toEqual(['search_tools', 'unique_inbox']);
    expect(second.tools.unique_inbox.inputSchema).toBeDefined();
  });

  it('search without auto-load reads no full schemas', async () => {
    const resolve = vi.fn(async () => executable('mail'));
    const processor = new ToolSearchProcessor({
      tools: {},
      deferredTools: async () => ({ mail: metadata('mail', resolve) }),
    });
    const first = await processor.processInputStep(step());
    await first.tools.search_tools.execute!({ query: 'mail' }, {} as never);
    expect(resolve).not.toHaveBeenCalled();
    await first.tools.load_tool!.execute!({ toolName: 'mail' }, {} as never);
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('binds loaded and resumed tools to the current request', async () => {
    const processor = new ToolSearchProcessor({
      tools: {},
      deferredTools: async ({ requestContext }) => ({
        mail: {
          id: 'mail',
          description: 'mailbox',
          resolve: async () => executable('mail', requestContext?.get('owner')),
        },
      }),
    });
    const a = new RequestContext([['owner', 'alice']]);
    const b = new RequestContext([['owner', 'bob']]);
    const first = await processor.processInputStep(step(a));
    await first.tools.load_tool!.execute!({ toolName: 'mail' }, {} as never);
    const resumed = await processor.getLoadedToolsForRequestContext({ requestContext: b });
    expect(await resumed.mail.execute!({ limit: 1 }, {} as never)).toBe('bob');
  });

  it('does not claim activation when schema resolution fails', async () => {
    const processor = new ToolSearchProcessor({
      tools: {},
      deferredTools: async () => ({
        mail: {
          id: 'mail',
          description: 'mailbox',
          resolve: async () => {
            throw Error('schema unavailable');
          },
        },
      }),
    });
    const first = await processor.processInputStep(step());
    await expect(first.tools.load_tool!.execute!({ toolName: 'mail' }, {} as never)).rejects.toThrow(
      'schema unavailable',
    );
    expect(await processor.getLoadedToolsForRequestContext()).toEqual({});
  });

  it('rejects reserved names and collisions without replacing existing tools', async () => {
    const processor = new ToolSearchProcessor({
      tools: { mail: executable('mail') },
      deferredTools: async () => ({ mail: metadata('mail') }),
    });
    const result = await processor.processInputStep(step());
    await expect(result.tools.search_tools.execute!({ query: 'mail' }, {} as never)).rejects.toThrow(
      'duplicate deferred tool',
    );
  });

  it('does not fetch connector metadata when only a local tool was loaded', async () => {
    const deferredTools = vi.fn(async () => ({}));
    const processor = new ToolSearchProcessor({ tools: { local: executable('local') }, deferredTools });
    const args = step();
    const first = await processor.processInputStep(args);
    await first.tools.load_tool!.execute!({ toolName: 'local' }, {} as never);
    deferredTools.mockClear();
    const second = await processor.processInputStep(args);
    expect(second.tools.local).toBeDefined();
    expect(deferredTools).not.toHaveBeenCalled();
  });

  it('withholds a revoked previously loaded connector while a plain reply remains possible', async () => {
    let revoked = false;
    const processor = new ToolSearchProcessor({
      tools: {},
      deferredTools: async () => ({
        mail: {
          id: 'mail',
          description: 'mailbox',
          resolve: async () => {
            if (revoked) throw Error('revoked');
            return executable('mail');
          },
        },
      }),
    });
    const args = step();
    const first = await processor.processInputStep(args);
    await first.tools.load_tool!.execute!({ toolName: 'mail' }, {} as never);
    revoked = true;
    const second = await processor.processInputStep(args);
    expect(Object.keys(second.tools)).toEqual(['search_tools', 'load_tool']);
    await expect(second.tools.load_tool!.execute!({ toolName: 'mail' }, {} as never)).rejects.toThrow('revoked');
  });

  it('preserves the number of ordinary filter calls without deferred tools', async () => {
    const filter = vi.fn(() => true);
    const processor = new ToolSearchProcessor({ tools: { mail: executable('mail') }, filter });
    const args = step();
    const first = await processor.processInputStep(args);
    await first.tools.load_tool!.execute!({ toolName: 'mail' }, {} as never);
    expect(filter.mock.calls).toHaveLength(1);
    filter.mockClear();
    await processor.processInputStep(args);
    expect(filter.mock.calls).toHaveLength(1);
  });

  it('fills search results after denied metadata without passing metadata to the ordinary filter', async () => {
    const resolve = vi.fn(async () => executable('allowed'));
    const filter = vi.fn(({ tool }) => Boolean(tool.inputSchema && tool.execute));
    const processor = new ToolSearchProcessor({
      tools: {},
      filter,
      search: { topK: 1, autoLoad: true },
      deferredFilter: ({ toolName }) => toolName === 'allowed',
      deferredTools: async () => ({
        denied1: { ...metadata('denied1'), description: 'mailbox mailbox mailbox' },
        denied2: { ...metadata('denied2'), description: 'mailbox mailbox mailbox' },
        denied3: { ...metadata('denied3'), description: 'mailbox mailbox mailbox' },
        allowed: { ...metadata('allowed', resolve), description: 'mailbox messages archive inbox' },
      }),
    });
    const first = await processor.processInputStep(step());
    const found = await first.tools.search_tools.execute!({ query: 'mailbox' }, {} as never);
    expect(found).toMatchObject({ results: [{ name: 'allowed' }] });
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(filter).toHaveBeenCalledTimes(1);
    expect(filter.mock.calls[0][0].tool.execute).toBeTypeOf('function');
  });
});
