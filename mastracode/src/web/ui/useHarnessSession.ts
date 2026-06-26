import { MastraClient } from '@mastra/client-js';
import type {
  HarnessAvailableModel,
  HarnessModeInfo,
  HarnessThreadInfo,
  HarnessSessionSettings,
  PlanResume,
  PermissionRules,
  PermissionPolicy,
  ToolCategory,
} from '@mastra/client-js';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { MASTRACODE_WEB_GIT_CLONE_CONTEXT_KEY } from '../git-clone-context';
import { initialTranscript, transcriptReducer } from './transcript';
import type { TranscriptState } from './transcript';

export type ConnectionStatus = 'connecting' | 'ready' | 'reconnecting' | 'error';

/** How many recent threads to load for the sidebar (it shows the newest few). */
const THREAD_PAGE_SIZE = 20;

type Session = ReturnType<ReturnType<MastraClient['getHarness']>['session']>;

function sessionTags(projectPath?: string, gitUrl?: string): Record<string, string> | undefined {
  if (gitUrl) return { gitUrl };
  if (projectPath) return { projectPath };
  return undefined;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface UseHarnessSessionArgs {
  harnessId: string;
  resourceId: string;
  /**
   * Absolute path of the active project. Used to scope the thread list to this
   * working directory, since one resourceId is shared across git worktrees of
   * the same repo. When omitted, all threads for the resource are listed.
   */
  projectPath?: string;
  gitUrl?: string;
  cloneParentPath?: string;
  /** Defaults to same-origin (Vite proxies /api → mastra dev). */
  baseUrl?: string;
  /**
   * When false, no session is created and no thread is opened. Used to keep the
   * app dormant until a project is selected (threads only exist within a project).
   */
  enabled?: boolean;
}

export interface HarnessSessionApi {
  transcript: TranscriptState;
  status: ConnectionStatus;
  modes: HarnessModeInfo[];
  models: HarnessAvailableModel[];
  threads: HarnessThreadInfo[];
  send: (text: string) => Promise<void>;
  steer: (text: string) => Promise<void>;
  abort: () => Promise<void>;
  followUp: (text: string) => Promise<void>;
  approveTool: (toolCallId: string, approved: boolean, promptId: string) => Promise<void>;
  respondSuspension: (
    toolCallId: string,
    resumeData: string | string[] | PlanResume,
    promptId: string,
  ) => Promise<void>;
  switchMode: (modeId: string) => Promise<void>;
  switchModel: (modelId: string) => Promise<void>;
  switchThread: (threadId: string) => Promise<void>;
  createThread: (title?: string) => Promise<void>;
  deleteThread: (threadId: string) => Promise<void>;
  renameThread: (threadId: string, title: string) => Promise<void>;
  cloneThread: (sourceThreadId?: string) => Promise<void>;
  refreshThreads: () => Promise<void>;
  setGoal: (objective: string) => Promise<void>;
  pauseGoal: () => Promise<void>;
  resumeGoal: () => Promise<void>;
  clearGoal: () => Promise<void>;
  getPermissions: () => Promise<PermissionRules>;
  setPermissionForCategory: (category: ToolCategory, policy: PermissionPolicy) => Promise<void>;
  setPermissionForTool: (toolName: string, policy: PermissionPolicy) => Promise<void>;
  /** Current agent behavior settings (yolo, thinking, notifications, smart editing). */
  settings: HarnessSessionSettings | null;
  /** Re-fetch behavior settings from the server (after a setState write). */
  refreshSettings: () => Promise<void>;
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
export function useHarnessSession({
  harnessId,
  resourceId,
  projectPath,
  gitUrl,
  cloneParentPath,
  baseUrl = '',
  enabled = true,
}: UseHarnessSessionArgs): HarnessSessionApi {
  const [transcript, dispatch] = useReducer(transcriptReducer, initialTranscript);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [modes, setModes] = useState<HarnessModeInfo[]>([]);
  const [threads, setThreads] = useState<HarnessThreadInfo[]>([]);

  const sessionRef = useRef<Session | null>(null);
  const harnessRef = useRef<ReturnType<MastraClient['getHarness']> | null>(null);
  const [models, setModels] = useState<HarnessAvailableModel[]>([]);
  const [settings, setSettings] = useState<HarnessSessionSettings | null>(null);

  const refreshSettings = useCallback(async () => {
    try {
      const state = await sessionRef.current?.state();
      if (state?.settings) setSettings(state.settings);
    } catch {
      /* non-fatal */
    }
  }, []);

  const refreshThreads = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    try {
      // The sidebar only shows the most recent threads — fetch a small page
      // instead of the resource's entire (potentially huge) thread history.
      // Scope to the active project path so worktrees sharing a resourceId
      // don't bleed each other's threads into the list.
      setThreads(
        await session.listThreads({
          limit: THREAD_PAGE_SIZE,
          tags: sessionTags(projectPath, gitUrl),
        }),
      );
    } catch {
      /* non-fatal */
    }
  }, [projectPath, gitUrl]);

  useEffect(() => {
    if (!enabled) {
      // No active project — stay dormant, don't create a session or thread.
      setStatus('connecting');
      setThreads([]);
      dispatch({ type: 'reset' });
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const MAX_RETRIES = 10;
    const MAX_DELAY_MS = 30_000;
    // Backoff attempt counter, shared across reconnects so it can be reset to 0
    // after any successful (re)connection rather than growing unbounded.
    let attempt = 0;

    function scheduleReconnect(session: Session): void {
      if (disposed) return;
      attempt += 1;
      if (attempt > MAX_RETRIES) {
        setStatus('error');
        return;
      }
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), MAX_DELAY_MS);
      reconnectTimer = setTimeout(() => void subscribe(session, true), delay);
    }

    async function subscribe(session: Session, isReconnect: boolean): Promise<void> {
      if (disposed) return;

      if (isReconnect) {
        setStatus('reconnecting');
        // Re-sync authoritative state and re-hydrate the thread history. Events
        // streamed during the disconnect are lost, so reload the persisted
        // messages instead of wiping the transcript to empty.
        try {
          const state = await session.state();
          if (disposed) return;
          const threadId = state.threadId;
          const messages = threadId
            ? await session.listMessages(threadId).catch(() => {
                // History reload failed — fall back to a state-only hydrate
                // (empty transcript) rather than failing the whole reconnect.
                return [];
              })
            : [];
          if (disposed) return;
          dispatch({
            type: 'hydrate',
            messages,
            modeId: state.modeId,
            modelId: state.modelId,
            threadId,
            omProgress: state.omProgress,
            usage: state.tokenUsage,
          });
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
            scheduleReconnect(session);
          },
        });
        unsubscribe = sub.unsubscribe;
        if (!disposed) {
          // Connection established — clear the backoff so a future disconnect
          // starts a fresh retry sequence instead of continuing to grow.
          attempt = 0;
          setStatus('ready');
        }
      } catch {
        scheduleReconnect(session);
      }
    }

    (async () => {
      const client = new MastraClient({ baseUrl });
      const harness = client.getHarness(harnessId);
      const session = harness.session(resourceId);
      sessionRef.current = session;
      harnessRef.current = harness;

      try {
        const [created, harnessModes] = await Promise.all([
          // Scope initial thread selection to the active project so worktrees
          // sharing a resourceId each resume their own thread.
          session.create({
            tags: sessionTags(projectPath, gitUrl),
            requestContext: gitUrl
              ? { [MASTRACODE_WEB_GIT_CLONE_CONTEXT_KEY]: { gitUrl, cloneParentPath } }
              : undefined,
          }),
          harness.listModes(),
        ]);
        if (disposed) return;
        setModes(harnessModes);

        // Load available models for the settings picker (non-fatal if it fails).
        // The catalog can be huge (thousands of entries), so keep only models
        // that have an API key configured — the ones the user can actually use.
        harness
          .listModels()
          .then(list => {
            if (disposed) return;
            // Only offer models with an API key configured. If none are set up,
            // leave the list empty (the picker hides) rather than dumping the
            // entire catalog into a select.
            setModels(list.filter(m => m.hasApiKey));
          })
          .catch(() => {});

        const state = await session.state();
        if (state.settings) setSettings(state.settings);
        // Resuming a thread that already has history: load and render it so the
        // view isn't empty until new events arrive. Falls back to a clean reset.
        const threadId = created.threadId ?? state.threadId;
        try {
          const messages = threadId ? await session.listMessages(threadId) : [];
          if (disposed) return;
          dispatch({
            type: 'hydrate',
            messages,
            modeId: state.modeId,
            modelId: state.modelId,
            threadId,
            omProgress: state.omProgress,
            usage: state.tokenUsage,
          });
        } catch {
          dispatch({
            type: 'reset',
            modeId: state.modeId,
            modelId: state.modelId,
            threadId,
            omProgress: state.omProgress,
            usage: state.tokenUsage,
          });
        }

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
  }, [harnessId, resourceId, projectPath, gitUrl, cloneParentPath, baseUrl, refreshThreads, enabled]);

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
    const session = sessionRef.current;
    if (!session) return;
    // Optimistically reflect the switch so the UI responds immediately, then
    // load the thread's history (it isn't replayed over the event stream).
    dispatch({ type: 'reset', threadId });
    try {
      await session.switchThread(threadId);
      const [messages, state] = await Promise.all([session.listMessages(threadId), session.state()]);
      dispatch({
        type: 'hydrate',
        messages,
        modeId: state.modeId,
        modelId: state.modelId,
        threadId,
        omProgress: state.omProgress,
        usage: state.tokenUsage,
      });
    } catch (err) {
      dispatch({ type: 'localNotice', level: 'error', text: `Failed to switch thread: ${errorText(err)}` });
    }
  }, []);

  const followUp = useCallback(async (text: string) => {
    const session = sessionRef.current;
    if (!session || !text.trim()) return;
    dispatch({ type: 'localUser', text });
    await session.followUp(text);
  }, []);

  const createThread = useCallback(
    async (title?: string) => {
      const session = sessionRef.current;
      if (!session) return;
      const thread = await session.createThread(title);
      dispatch({ type: 'reset', threadId: thread.id });
      void refreshThreads();
    },
    [refreshThreads],
  );

  const deleteThread = useCallback(
    async (threadId: string) => {
      await sessionRef.current?.deleteThread(threadId);
      void refreshThreads();
    },
    [refreshThreads],
  );

  const renameThread = useCallback(
    async (threadId: string, title: string) => {
      await sessionRef.current?.renameThread(threadId, title);
      void refreshThreads();
    },
    [refreshThreads],
  );

  const cloneThread = useCallback(
    async (sourceThreadId?: string) => {
      const session = sessionRef.current;
      if (!session) return;
      const thread = await session.cloneThread(sourceThreadId ? { sourceThreadId } : undefined);
      dispatch({ type: 'reset', threadId: thread.id });
      void refreshThreads();
    },
    [refreshThreads],
  );

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
    models,
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
    settings,
    refreshSettings,
    setState,
    pushNotice,
  };
}
