// @vitest-environment jsdom
import type { MastraClient } from '@mastra/client-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../test/msw-server';
import { makeWrapper } from '../../../test/render';
import { useProcessors } from '../use-processors';

const processors: Awaited<ReturnType<MastraClient['listProcessors']>> = {
  'pii-redactor': {
    id: 'pii-redactor',
    name: 'PII redactor',
    phases: ['input'],
    agentIds: [],
    configurations: [],
    isWorkflow: false,
  },
};

afterEach(() => cleanup());

describe('useProcessors', () => {
  describe('when the server lists processors', () => {
    it('returns processors keyed by id', async () => {
      server.use(http.get('*/api/processors', () => HttpResponse.json(processors)));
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useProcessors(), { wrapper });
      await waitFor(() => expect(Object.keys(result.current.data ?? {})).toEqual(['pii-redactor']));
    });
  });
});
