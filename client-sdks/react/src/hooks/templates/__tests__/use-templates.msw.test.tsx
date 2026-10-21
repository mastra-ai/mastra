// @vitest-environment jsdom
import type { MastraClient } from '@mastra/client-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../test/msw-server';
import { makeWrapper } from '../../../test/render';
import { useAgentBuilderWorkflow } from '../use-templates';

type ActionDetails = Awaited<ReturnType<ReturnType<MastraClient['getAgentBuilderAction']>['details']>>;

const action: ActionDetails = {
  name: 'merge-template',
  steps: {},
  allSteps: {},
  stepGraph: [],
};

afterEach(() => cleanup());

describe('useAgentBuilderWorkflow', () => {
  describe('when the merge-template action exists', () => {
    it('returns its details', async () => {
      server.use(http.get('*/api/agent-builder/merge-template', () => HttpResponse.json(action)));
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useAgentBuilderWorkflow(), { wrapper });
      await waitFor(() => expect(result.current.data?.name).toBe('merge-template'));
    });
  });
});
