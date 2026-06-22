import { MastraClient } from '@mastra/client-js';
import type { HarnessModeInfo, HarnessThreadInfo, PlanResume, PermissionRules, PermissionPolicy, ToolCategory } from '@mastra/client-js';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { initialTranscript, transcriptReducer } from './transcript';
import type { TranscriptState } from './transcript';

export type ConnectionStatus = 'connecting' | 'ready' | 'reconnecting' | 'error';

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
  followUp: (text: string) => Promise<void>;
  approveTool: (toolCallId: string, approved: boolean, promptId: string) => Promise<void>;
  respondSuspension: (toolCallId: string, resumeData: string | string[] | PlanResume, promptId: string) => Promise<void>;
  switchMode: (modeId: string) => Promise<void>;
  switchModel: (modelId: string) => Promise<void>;
  switchThread: (threadId: string) => Promise<void>;
  createThread: (title?: string) => Promise<void>;
  deleteThread: (threadId: string) => Promise<void>;
  renameThread: (threadId: string, title: string) => Promise<void>;
  cloneThread: () => Promise<void>;
  refreshThreads: () => Promise<void>;
  setGoal: (objective: string) => Promise<void>;
  pauseGoal: () => Promise<void>;
  resumeGoal: () => Promise<void>;
  clearGoal: () => Promise<void>;
  getPermissions: () => Promise<PermissionRules>;
  setPermissionForCategory: (category: ToolCategory, policy: PermissionPolicy) => Promise<void>;
  setPermissionForTool: (toolName: string, policy: PermissionPolicy) => Promise<void>;
  /** Merge key-value pairs into the server-side session state. */
  setState: (updates: Record<string, unknown>) => Promise<void>;
  /** Push a local notice into the transcript (for slash-command output). */
  pushNotice: (text: string, level?: 'info' | 'error') => void;
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
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const MAX_RETRIES = 10;
    const MAX_DELAY_MS = 30_000;

    async function subscribe(session: Session, isReconnect: boolean, attempt = 0): Promise<void> {
      if (disposed) return;

      if (isReconnect) {
        setStatus('reconnecting');
        // Re-sync authoritative state (events missed during disconnect are lost).
        try {
          const state = await session.state();
          if (disposed) return;
          dispatch({ type: 'reset', modeId: state.modeId, modelId: state.modelId, threadId: state.threadId });
        } catch {
          // State re-sync failed — still try to subscribe.
        }
      }

      try {
        const sub = await session.subscribe({
          onEvent: event => dispatch({ type: 'event', event }),
          onError: () => {
            unsubscribe?.();
            unsubscribe = undefined;
            if (disposed) return;

            const nextAttempt = attempt + 1;
            if (nextAttempt > MAX_RETRIES) {
              setStatus('error');
              return;
            }
            const delay = Math.min(1000 * Math.pow(2, attempt), MAX_DELAY_MS);
            reconnectTimer = setTimeout(() => void subscribe(session, true, nextAttempt), delay);
          },
        });
        unsubscribe = sub.unsubscribe;
        if (!disposed) setStatus('ready');
      } catch {
        if (disposed) return;
        const nextAttempt = attempt + 1;
        if (nextAttempt > MAX_RETRIES) {
          setStatus('error');
          return;
        }
        const delay = Math.min(1000 * Math.pow(2, attempt), MAX_DELAY_MS);
        reconnectTimer = setTimeout(() => void subscribe(session, true, nextAttempt), delay);
      }
    }

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

        await subscribe(session, false);
        if (!disposed) void refreshThreads();
      } catch {
        if (!disposed) setStatus('error');
      }
    })();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
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

  const followUp = useCallback(async (text: string) => {
    const session = sessionRef.current;
    if (!session || !text.trim()) return;
    dispatch({ type: 'localUser', text });
    await session.followUp(text);
  }, []);

  const createThread = useCallback(async (title?: string) => {
    const session = sessionRef.current;
    if (!session) return;
    const thread = await session.createThread(title);
    dispatch({ type: 'reset', threadId: thread.id });
    void refreshThreads();
  }, [refreshThreads]);

  const deleteThread = useCallback(async (threadId: string) => {
    await sessionRef.current?.deleteThread(threadId);
    void refreshThreads();
  }, [refreshThreads]);

  const renameThread = useCallback(async (threadId: string, title: string) => {
    await sessionRef.current?.renameThread(threadId, title);
    void refreshThreads();
  }, [refreshThreads]);

  const cloneThread = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    const thread = await session.cloneThread();
    dispatch({ type: 'reset', threadId: thread.id });
    void refreshThreads();
  }, [refreshThreads]);

  const setGoal = useCallback(async (objective: string) => {
    await sessionRef.current?.setGoal(objective);
  }, []);

  const pauseGoal = useCallback(async () => {
    await sessionRef.current?.updateGoal({ status: 'paused' });
  }, []);

  const resumeGoal = useCallback(async () => {
    await sessionRef.current?.updateGoal({ status: 'active' });
  }, []);

  const clearGoal = useCallback(async () => {
    await sessionRef.current?.clearGoal();
  }, []);

  const pushNotice = useCallback((text: string, level: 'info' | 'error' = 'info') => {
    dispatch({ type: 'localNotice', text, level });
  }, []);

  const getPermissions = useCallback(async (): Promise<PermissionRules> => {
    return (await sessionRef.current?.getPermissions()) ?? { categories: {}, tools: {} };
  }, []);

  const setPermissionForCategory = useCallback(async (category: ToolCategory, policy: PermissionPolicy) => {
    await sessionRef.current?.setPermissionForCategory(category, policy);
  }, []);

  const setPermissionForTool = useCallback(async (toolName: string, policy: PermissionPolicy) => {
    await sessionRef.current?.setPermissionForTool(toolName, policy);
  }, []);

  const setState = useCallback(async (updates: Record<string, unknown>) => {
    await sessionRef.current?.setState(updates);
  }, []);

  return {
    transcript,
    status,
    modes,
    threads,
    send,
    steer,
    abort,
    followUp,
    approveTool,
    respondSuspension,
    switchMode,
    switchModel,
    switchThread,
    createThread,
    deleteThread,
    renameThread,
    cloneThread,
    refreshThreads,
    setGoal,
    pauseGoal,
    resumeGoal,
    clearGoal,
    getPermissions,
    setPermissionForCategory,
    setPermissionForTool,
    setState,
    pushNotice,
  };
}
