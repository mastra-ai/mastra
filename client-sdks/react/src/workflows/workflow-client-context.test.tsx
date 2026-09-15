import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createdOptions: Array<Record<string, unknown>> = [];
const workflowClient = { getWorkflow: vi.fn() };

vi.mock('@mastra/client-js/workflows', () => ({
  createWorkflowClient: (options: Record<string, unknown>) => {
    createdOptions.push(options);
    return workflowClient;
  },
}));

const { MastraWorkflowProvider, useWorkflowClient } = await import('./workflow-client-context');

describe('MastraWorkflowProvider', () => {
  beforeEach(() => {
    createdOptions.length = 0;
  });

  it('creates the workflow-only client with a platform fetch implementation', () => {
    const platformFetch = vi.fn<typeof fetch>();
    let capturedClient: unknown;

    function Inspector() {
      capturedClient = useWorkflowClient();
      return null;
    }

    renderToString(
      createElement(MastraWorkflowProvider, {
        baseUrl: 'https://mastra.example',
        customFetch: platformFetch,
        children: createElement(Inspector),
      }),
    );

    expect(capturedClient).toBe(workflowClient);
    expect(createdOptions).toEqual([
      expect.objectContaining({
        baseUrl: 'https://mastra.example',
        credentials: 'include',
        fetch: platformFetch,
      }),
    ]);
  });
});
