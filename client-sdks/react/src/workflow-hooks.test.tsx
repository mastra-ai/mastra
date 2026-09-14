// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  MastraReactProvider,
  useCancelWorkflowRun,
  useCreateWorkflowRun,
  useMastraClient,
  useStreamWorkflow,
} from './workflow-hooks';
import { MastraReactProvider as RootProvider, useMastraClient as useRootClient } from './index';

describe('workflow-only entry', () => {
  it('shares the existing provider and client context with the root entry', () => {
    expect(MastraReactProvider).toBe(RootProvider);
    expect(useMastraClient).toBe(useRootClient);
    const wrapper = ({ children }: PropsWithChildren) => (
      <RootProvider baseUrl="https://mastra.example">{children}</RootProvider>
    );
    const { result } = renderHook(() => [useMastraClient(), useRootClient()], { wrapper });
    expect(result.current[0]).toBe(result.current[1]);
    expect(result.current[0].getWorkflow).toBeTypeOf('function');
  });

  it('uses the existing client for creating, streaming, and canceling runs', async () => {
    const customFetch = vi.fn<typeof fetch>(async input => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.pathname.endsWith('/create-run')) {
        return Response.json({ runId: 'run-1' });
      }
      if (url.pathname.endsWith('/stream')) {
        // The existing workflow client decodes record-separated JSON.
        return new Response(
          [
            { type: 'workflow-start', payload: {} },
            { type: 'workflow-step-result', payload: { id: 'step-1', status: 'success', output: { text: 'done' } } },
            { type: 'workflow-finish', payload: { workflowStatus: 'success' } },
          ]
            .map(chunk => JSON.stringify(chunk) + '\x1e')
            .join(''),
        );
      }
      if (url.pathname.endsWith('/cancel')) {
        return Response.json({ message: 'Workflow run canceled' });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <MastraReactProvider baseUrl="https://mastra.example" customFetch={customFetch}>
        {children}
      </MastraReactProvider>
    );
    const { result } = renderHook(
      () => ({
        create: useCreateWorkflowRun(),
        cancel: useCancelWorkflowRun(),
        stream: useStreamWorkflow({ debugMode: false }),
      }),
      { wrapper },
    );
    await act(async () => {
      expect(await result.current.create.mutateAsync({ workflowId: 'example' })).toEqual({ runId: 'run-1' });
    });
    expect(result.current.stream.isStreaming).toBe(false);
    await act(async () => {
      await result.current.stream.streamWorkflow.mutateAsync({
        workflowId: 'example',
        runId: 'run-1',
        inputData: { text: 'hello' },
        requestContext: {},
      });
    });
    expect(result.current.stream.streamResult).toMatchObject({ status: 'success', result: { text: 'done' } });
    expect(result.current.stream.isStreaming).toBe(false);
    await act(async () => {
      expect(await result.current.cancel.mutateAsync({ workflowId: 'example', runId: 'run-1' })).toEqual({
        message: 'Workflow run canceled',
      });
    });
    expect(customFetch).toHaveBeenCalledTimes(5);
  });
});
