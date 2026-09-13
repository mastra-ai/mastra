import type { IMastraEditor, IWorkflowBuilder } from '@mastra/core/editor';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';
import { MASTRA_IS_STUDIO_KEY, MASTRA_RESOURCE_ID_KEY } from '../constants';
import { mergeBodyRequestContext } from './utils';
import { GET_WORKFLOW_BUILDER_SETTINGS_ROUTE, STREAM_WORKFLOW_BUILDER_ROUTE } from './workflow-builder';

const createMockMastra = (editor?: Partial<IMastraEditor>) =>
  ({
    getEditor: () => editor,
  }) as any;

const createEnabledMastra = (agent: any) => {
  const builder = { enabled: true, getAgent: () => agent } as unknown as IWorkflowBuilder;
  return createMockMastra({
    hasEnabledWorkflowBuilderConfig: () => true,
    resolveWorkflowBuilder: vi.fn().mockResolvedValue(builder),
  });
};

describe('GET /editor/workflow-builder/settings', () => {
  it('uses the stored-workflow read permission', () => {
    expect(GET_WORKFLOW_BUILDER_SETTINGS_ROUTE.requiresPermission).toBe('stored-workflows:read');
  });

  it('returns disabled without resolving EE when configuration is absent', async () => {
    const resolveWorkflowBuilder = vi.fn();
    const mastra = createMockMastra({
      hasEnabledWorkflowBuilderConfig: () => false,
      resolveWorkflowBuilder,
    });

    await expect(GET_WORKFLOW_BUILDER_SETTINGS_ROUTE.handler({ mastra } as any)).resolves.toEqual({ enabled: false });
    expect(resolveWorkflowBuilder).not.toHaveBeenCalled();
  });

  it('returns enabled for an active hidden workflow builder', async () => {
    const builder: IWorkflowBuilder = {
      enabled: true,
      getAgent: vi.fn() as IWorkflowBuilder['getAgent'],
      getModelPolicy: () => ({
        active: true,
        pickerVisible: false,
        default: { provider: 'openai', modelId: 'gpt-4o-mini' },
      }),
    };
    const mastra = createMockMastra({
      hasEnabledWorkflowBuilderConfig: () => true,
      resolveWorkflowBuilder: vi.fn().mockResolvedValue(builder),
    });

    await expect(GET_WORKFLOW_BUILDER_SETTINGS_ROUTE.handler({ mastra } as any)).resolves.toEqual({
      enabled: true,
      modelPolicy: {
        active: true,
        pickerVisible: false,
        default: { provider: 'openai', modelId: 'gpt-4o-mini' },
      },
    });
  });
});

describe('POST /editor/workflow-builder/stream', () => {
  it('uses the stored-workflow write permission', () => {
    expect(STREAM_WORKFLOW_BUILDER_ROUTE.requiresPermission).toBe('stored-workflows:write');
  });

  it('streams from the hidden builder and propagates request context and abort signal', async () => {
    const fullStream = Symbol('fullStream');
    const stream = vi.fn().mockResolvedValue({ fullStream });
    const agent = { stream, getMemory: vi.fn().mockResolvedValue(undefined) };
    const builder = { enabled: true, getAgent: () => agent } as unknown as IWorkflowBuilder;
    const mastra = createMockMastra({
      hasEnabledWorkflowBuilderConfig: () => true,
      resolveWorkflowBuilder: vi.fn().mockResolvedValue(builder),
    });
    const requestContext = new RequestContext();
    const abortController = new AbortController();

    const result = await STREAM_WORKFLOW_BUILDER_ROUTE.handler({
      mastra,
      messages: [{ role: 'user', content: 'Create a workflow' }],
      requestContext,
      abortSignal: abortController.signal,
      memory: undefined,
      structuredOutput: undefined,
    } as any);

    expect(result).toBe(fullStream);
    expect(stream).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Create a workflow' }],
      expect.objectContaining({ requestContext, abortSignal: abortController.signal }),
    );
  });

  it('returns 400 when memory is requested but no resource ID is resolvable', async () => {
    const stream = vi.fn();
    const agent = { stream, getMemory: vi.fn().mockResolvedValue(undefined) };
    const mastra = createEnabledMastra(agent);

    await expect(
      STREAM_WORKFLOW_BUILDER_ROUTE.handler({
        mastra,
        messages: [{ role: 'user', content: 'Create a workflow' }],
        requestContext: new RequestContext(),
        memory: { thread: 'thread-1' },
      } as any),
    ).rejects.toMatchObject({ status: 400 });
    expect(stream).not.toHaveBeenCalled();
  });

  it('prefers the server-derived resource ID over a body-supplied one', async () => {
    const stream = vi.fn().mockResolvedValue({ fullStream: Symbol('fullStream') });
    const agent = { stream, getMemory: vi.fn().mockResolvedValue(undefined) };
    const mastra = createEnabledMastra(agent);
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'server-resource');

    await STREAM_WORKFLOW_BUILDER_ROUTE.handler({
      mastra,
      messages: [{ role: 'user', content: 'Create a workflow' }],
      requestContext,
      memory: { thread: 'thread-1', resource: 'body-resource' },
    } as any);

    expect(stream).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        memory: expect.objectContaining({ resource: 'server-resource', thread: 'thread-1' }),
      }),
    );
  });

  // The stream handler merges any body-supplied requestContext through the shared
  // mergeBodyRequestContext helper (same as agent execution routes), so the server
  // context stays authoritative. The authority semantics are covered below.
  describe('body requestContext merging (mergeBodyRequestContext)', () => {
    it('keeps server request-context values authoritative over body values', () => {
      const serverRequestContext = new RequestContext();
      serverRequestContext.set('tenant', 'server-tenant');

      mergeBodyRequestContext(serverRequestContext, { tenant: 'body-tenant', locale: 'fr' });

      expect(serverRequestContext.get('tenant')).toBe('server-tenant');
      expect(serverRequestContext.get('locale')).toBe('fr');
    });

    it('ignores reserved keys in a body-supplied requestContext', () => {
      const serverRequestContext = new RequestContext();

      mergeBodyRequestContext(serverRequestContext, {
        [MASTRA_IS_STUDIO_KEY]: true,
        [MASTRA_RESOURCE_ID_KEY]: 'forged-resource',
      });

      expect(serverRequestContext.get(MASTRA_IS_STUDIO_KEY)).toBeUndefined();
      expect(serverRequestContext.get(MASTRA_RESOURCE_ID_KEY)).toBeUndefined();
    });
  });

  it('rejects access to a thread owned by a different resource', async () => {
    const stream = vi.fn();
    const memory = { getThreadById: vi.fn().mockResolvedValue({ id: 'thread-1', resourceId: 'other-resource' }) };
    const agent = { stream, getMemory: vi.fn().mockResolvedValue(memory) };
    const mastra = createEnabledMastra(agent);

    await expect(
      STREAM_WORKFLOW_BUILDER_ROUTE.handler({
        mastra,
        messages: [{ role: 'user', content: 'Create a workflow' }],
        requestContext: new RequestContext(),
        memory: { thread: 'thread-1', resource: 'resource-a' },
      } as any),
    ).rejects.toMatchObject({ status: 403 });
    expect(stream).not.toHaveBeenCalled();
  });
});
