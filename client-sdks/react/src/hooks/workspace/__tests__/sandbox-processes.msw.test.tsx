// @vitest-environment jsdom
import type { ListSandboxProcessesResponse, SandboxProcess } from '@mastra/client-js';
import { act, cleanup, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { server } from '../../../test/msw-server';
import { renderHookWithProviders } from '../../../test/render';
import { useKillSandboxProcess, useSandboxProcesses } from '../use-sandbox-processes';
import { WORKSPACE_ID, WORKSPACE_URL } from './fixtures/workspace';

const devServer: SandboxProcess = {
  pid: 'exec/1',
  command: 'npm run dev',
  running: true,
  metadata: { threadId: 'thread-1', resourceId: 'user-1', toolCallId: 'call-1', startedAt: 1_700_000_000_000 },
};

afterEach(() => cleanup());

describe('useKillSandboxProcess', () => {
  describe("when a thread's process is listed", () => {
    it("kills it and the thread's process list drops it", async () => {
      let running: SandboxProcess[] = [devServer];
      const killed: Array<{ pid: string; threadId: string | null }> = [];
      server.use(
        http.get(`${WORKSPACE_URL}/sandbox/processes`, ({ request }) => {
          const threadId = new URL(request.url).searchParams.get('threadId');
          const body: ListSandboxProcessesResponse = {
            processes: running.filter(p => p.metadata?.threadId === threadId),
          };
          return HttpResponse.json(body);
        }),
        http.post(`${WORKSPACE_URL}/sandbox/processes/:pid/kill`, ({ request, params }) => {
          const pid = decodeURIComponent(params.pid as string);
          killed.push({ pid, threadId: new URL(request.url).searchParams.get('threadId') });
          running = running.filter(p => p.pid !== pid);
          return HttpResponse.json({ pid, killed: true });
        }),
      );

      const { result } = renderHookWithProviders(() => ({
        list: useSandboxProcesses({ workspaceId: WORKSPACE_ID, threadId: 'thread-1' }),
        kill: useKillSandboxProcess({ workspaceId: WORKSPACE_ID }),
      }));
      await waitFor(() => expect(result.current.list.data?.processes).toEqual([devServer]));

      await act(() => result.current.kill.mutateAsync({ pid: 'exec/1', threadId: 'thread-1' }));

      expect(killed).toEqual([{ pid: 'exec/1', threadId: 'thread-1' }]);
      await waitFor(() => expect(result.current.list.data?.processes).toEqual([]));
    });
  });
});
