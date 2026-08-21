import type { IMastraEditor, IWorkflowBuilder } from '@mastra/core/editor';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';
import { GET_WORKFLOW_BUILDER_SETTINGS_ROUTE, STREAM_WORKFLOW_BUILDER_ROUTE } from './workflow-builder';

const createMockMastra = (editor?: Partial<IMastraEditor>) =>
  ({
    getEditor: () => editor,
  }) as any;

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
});
