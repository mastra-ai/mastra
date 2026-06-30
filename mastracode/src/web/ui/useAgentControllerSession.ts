import { MastraClient } from '@mastra/client-js';
import type {
  AgentControllerAvailableModel,
  AgentControllerModeInfo,
  AgentControllerThreadInfo,
  AgentControllerSessionSettings,
  PlanResume,
  PermissionRules,
  PermissionPolicy,
  ToolCategory,
} from '@mastra/client-js';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { initialTranscript, transcriptReducer } from './transcript';
import type { TranscriptState } from './transcript';

export type ConnectionStatus = 'connecting' | 'ready' | 'reconnecting' | 'error';

/** How many recent threads to load for the sidebar (it shows the newest few). */
const THREAD_PAGE_SIZE = 20;

type Session = ReturnType<ReturnType<MastraClient['getAgentController']>['session']>;

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface UseAgentControllerSessionArgs {
  agentControllerId: string;
  resourceId: string;
  /**
   * Absolute path of the active project. Used to scope the thread list to this
   * working directory, since one resourceId is shared across git worktrees of
   * the same repo. When omitted, all threads for the resource are listed.
   */
  projectPath?: string;
  /** Defaults to same-origin (Vite proxies /api → mastra dev). */
  baseUrl?: string;
  /**
   * When false, no session is created and no thread is opened. Used to keep the
   * app dormant until a project is selected (threads only exist within a project).
   */
  enabled?: boolean;
}

export interface AgentControllerSessionApi {
  transcript: TranscriptState;
  status: ConnectionStatus;
  modes: AgentControllerModeInfo[];
  models: AgentControllerAvailableModel[];
  threads: AgentControllerThreadInfo[];
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
  settings: AgentControllerSessionSettings | null;
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
export function useAgentControllerSession({
  agentControllerId,
  resourceId,
  projectPath,
  baseUrl = '',
  enabled = true,
}: UseAgentControllerSessionArgs): AgentControllerSessionApi {
  const [transcript, dispatch] = useReducer(transcriptReducer, initialTranscript);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [modes, setModes] = useState<AgentControllerModeInfo[]>([]);
  const [threads, setThreads] = useState<AgentControllerThreadInfo[]>([]);

  const sessionRef = useRef<Session | null>(null);
  const agentControllerRef = useRef<ReturnType<MastraClient['getAgentController']> | null>(null);
  // The session-init effect intentionally does not re-run on projectPath changes
  // (that would re-subscribe the stream). Mirror the latest value into a ref so
  // thread creation always tags with the current worktree path, even when the
  // path resolves a tick after the session connects.
  const projectPathRef = useRef(projectPath);
  projectPathRef.current = projectPath;
  const [models, setModels] = useState<AgentControllerAvailableModel[]>([]);
  const [settings, setSettings] = useState<AgentControllerSessionSettings | null>(null);

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
          tags: projectPath ? { projectPath } : undefined,
        }),
      );
    } catch {
      /* non-fatal */
    }
  }, [projectPath]);

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
      const controller = client.getAgentController(agentControllerId);
      const session = controller.session(resourceId);
      sessionRef.current = session;
      agentControllerRef.current = controller;

      try {
        const [created, agentControllerModes] = await Promise.all([
          // Scope initial thread selection to the active project so worktrees
          // sharing a resourceId each resume their own thread. Read the ref so a
          // path that resolved just after connect still tags the thread.
          session.create({ tags: projectPathRef.current ? { projectPath: projectPathRef.current } : undefined }),
          controller.listModes(),
        ]);
        if (disposed) return;
        setModes(agentControllerModes);

        // Load available models for the settings picker (non-fatal if it fails).
        // The catalog can be huge (thousands of entries), so keep only models
        // that have an API key configured — the ones the user can actually use.
        controller
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
  }, [agentControllerId, resourceId, baseUrl, refreshThreads, enabled]);

  const send = useCallback(
    async (text: string) => {
      const session = sessionRef.current;
      if (!session || !text.trim()) return;
      dispatch({ type: 'localUser', text });
      await session.sendMessage(text);
      // The first message in the zero state turns the freshly-bound thread into
      // a listable one (and gives it a title). Refresh so it shows in the
      // sidebar instead of staying on "No conversations yet".
      void refreshThreads();
    },
    [refreshThreads],
  );

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
