// @vitest-environment jsdom
import type { MastraClient } from '@mastra/client-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../test/msw-server';
import { makeWrapper } from '../../../test/render';
import { useReadAloud } from '../use-read-aloud';

afterEach(() => cleanup());

describe('useReadAloud', () => {
  describe('when the agent voice fails to speak', () => {
    it('reports the error through onError', async () => {
      server.use(
        http.get('*/api/agents/agent-1/voice/speakers', () => HttpResponse.json([{ voiceId: 'alloy' }])),
        http.post('*/api/agents/agent-1/voice/speak', () => HttpResponse.json({ error: 'boom' }, { status: 500 })),
      );
      const onError = vi.fn<(error: unknown) => void>();
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useReadAloud('agent-1', undefined, { onError }), { wrapper });

      await waitFor(() => expect(result.current).toBeDefined());
      await new Promise(r => setTimeout(r, 50));
      await act(async () => {
        await result.current.readAloud('hello');
      });

      expect(onError).toHaveBeenCalledTimes(1);
      expect(result.current.isSpeaking).toBe(false);
    });
  });
});
