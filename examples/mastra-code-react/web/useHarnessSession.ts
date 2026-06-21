import { MastraClient } from '@mastra/client-js';
import type { HarnessModeInfo, HarnessThreadInfo, PlanResume } from '@mastra/client-js';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { initialTranscript, transcriptReducer } from './transcript';
import type { TranscriptState } from './transcript';

export type ConnectionStatus = 'connecting' | 'ready' | 'error';

type Session = ReturnType<ReturnType<MastraClient['getHarness']>['session']>;

interface UseHarnessSessionArgs {
  harnessId: string;
  resourceId: string;
  /** Defaults to same-origin (Vite proxies /api → mastra dev). */
  baseUrl?: string;
}

export interface HarnessSessionApi {
  transcript: TranscriptState;
  status: ConnectionStatus;
  modes: HarnessModeInfo[];
  threads: HarnessThreadInfo[];
  send: (text: string) => Promise<void>;
  steer: (text: string) => Promise<void>;
  abort: () => Promise<void>;
  approveTool: (toolCallId: string, approved: boolean, promptId: string) => Promise<void>;
  respondSuspension: (toolCallId: string, resumeData: string | string[] | PlanResume, promptId: string) => Promise<void>;
  switchMode: (modeId: string) => Promise<void>;
  switchModel: (modelId: string) => Promise<void>;
  switchThread: (threadId: string) => Promise<void>;
  refreshThreads: () => Promise<void>;
}

/**
 * Drives one MastraCode session from React: creates/resumes it, opens the SSE
 * stream, folds events through the transcript reducer, and exposes the full
 * run-control + mode/model/thread surface the UI needs.
 */
export function useHarnessSession({ harnessId, resourceId, baseUrl = '' }: UseHarnessSessionArgs): HarnessSessionApi {
  const [transcript, dispatch] = useReducer(transcriptReducer, initialTranscript);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [modes, setModes] = useState<HarnessModeInfo[]>([]);
  const [threads, setThreads] = useState<HarnessThreadInfo[]>([]);

  const sessionRef = useRef<Session | null>(null);

  const refreshThreads = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    try {
      setThreads(await session.listThreads());
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let disposed = false;

    (async () => {
      const client = new MastraClient({ baseUrl });
      const harness = client.getHarness(harnessId);
      const session = harness.session(resourceId);
      sessionRef.current = session;

      try {
        const [created, harnessModes] = await Promise.all([session.create(), harness.listModes()]);
        if (disposed) return;
        setModes(harnessModes);

        const state = await session.state();
        dispatch({ type: 'reset', modeId: state.modeId, modelId: state.modelId, threadId: created.threadId });

        const sub = await session.subscribe({
          onEvent: event => dispatch({ type: 'event', event }),
          onError: () => setStatus('error'),
        });
        unsubscribe = sub.unsubscribe;
        if (!disposed) {
          setStatus('ready');
          void refreshThreads();
        }
      } catch {
        if (!disposed) setStatus('error');
      }
    })();

    return () => {
      disposed = true;
      unsubscribe?.();
      sessionRef.current = null;
    };
  }, [harnessId, resourceId, baseUrl, refreshThreads]);

  const send = useCallback(async (text: string) => {
    const session = sessionRef.current;
    if (!session || !text.trim()) return;
    dispatch({ type: 'localUser', text });
    await session.sendMessage(text);
  }, []);

  const steer = useCallback(async (text: string) => {
    const session = sessionRef.current;
    if (!session || !text.trim()) return;
    dispatch({ type: 'localUser', text, steer: true });
    await session.steer(text);
  }, []);

  const abort = useCallback(async () => {
    await sessionRef.current?.abort();
  }, []);

  const approveTool = useCallback(async (toolCallId: string, approved: boolean, promptId: string) => {
    dispatch({ type: 'resolvePrompt', id: promptId });
    await sessionRef.current?.approveTool(toolCallId, approved);
  }, []);

  const respondSuspension = useCallback(
    async (toolCallId: string, resumeData: string | string[] | PlanResume, promptId: string) => {
      dispatch({ type: 'resolvePrompt', id: promptId });
      await sessionRef.current?.respondToToolSuspension(toolCallId, resumeData);
    },
    [],
  );

  const switchMode = useCallback(async (modeId: string) => {
    await sessionRef.current?.switchMode(modeId);
  }, []);

  const switchModel = useCallback(async (modelId: string) => {
    await sessionRef.current?.switchModel(modelId);
  }, []);

  const switchThread = useCallback(async (threadId: string) => {
    await sessionRef.current?.switchThread(threadId);
    dispatch({ type: 'reset', threadId });
  }, []);

  return {
    transcript,
    status,
    modes,
    threads,
    send,
    steer,
    abort,
    approveTool,
    respondSuspension,
    switchMode,
    switchModel,
    switchThread,
    refreshThreads,
  };
}
