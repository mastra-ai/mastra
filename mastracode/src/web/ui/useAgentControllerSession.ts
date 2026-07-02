import { MastraClient } from '@mastra/client-js';
import type {
  AgentControllerAvailableModel,
  AgentControllerModeInfo,
  AgentControllerSessionSettings,
  PlanResume,
  PermissionRules,
  PermissionPolicy,
  ToolCategory,
} from '@mastra/client-js';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { initialTranscript, transcriptReducer } from './transcript';
import type { TranscriptState } from './transcript';
import {
  useAgentControllerModelsQuery,
  useAgentControllerPermissionsQuery,
  useAgentControllerSettingsQuery,
  useAgentControllerThreadsQuery,
  useCloneAgentControllerThreadMutation,
  useCreateAgentControllerThreadMutation,
  useDeleteAgentControllerThreadMutation,
  useRenameAgentControllerThreadMutation,
  useSetAgentControllerStateMutation,
  useSetPermissionForCategoryMutation,
  useSwitchAgentControllerModeMutation,
  useSwitchAgentControllerModelMutation,
} from './useAgentControllerQueries';

export type ConnectionStatus = 'connecting' | 'ready' | 'reconnecting' | 'error';

type Controller = ReturnType<MastraClient['getAgentController']>;
type Session = ReturnType<Controller['session']>;

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
  threads: Awaited<ReturnType<Session['listThreads']>>;
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
  permissions: PermissionRules | null;
  pendingPermissionCategory: ToolCategory | null;
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
  const [controller, setController] = useState<Controller | null>(null);
  const [querySession, setQuerySession] = useState<Session | null>(null);

  const sessionRef = useRef<Session | null>(null);

  const queryScope = { agentControllerId, resourceId };
  const modelsQuery = useAgentControllerModelsQuery(controller, enabled, { agentControllerId });
  const settingsQuery = useAgentControllerSettingsQuery(querySession, enabled, queryScope);
  const permissionsQuery = useAgentControllerPermissionsQuery(querySession, enabled, queryScope);
  const threadsQuery = useAgentControllerThreadsQuery(querySession, projectPath, enabled, queryScope);
  const setStateMutation = useSetAgentControllerStateMutation(querySession, queryScope);
  const setPermissionForCategoryMutation = useSetPermissionForCategoryMutation(querySession, queryScope);
  const createThreadMutation = useCreateAgentControllerThreadMutation(querySession, projectPath, queryScope);
  const deleteThreadMutation = useDeleteAgentControllerThreadMutation(querySession, projectPath, queryScope);
  const renameThreadMutation = useRenameAgentControllerThreadMutation(querySession, projectPath, queryScope);
  const cloneThreadMutation = useCloneAgentControllerThreadMutation(querySession, projectPath, queryScope);
  const switchModeMutation = useSwitchAgentControllerModeMutation(querySession, queryScope);
  const switchModelMutation = useSwitchAgentControllerModelMutation(querySession, queryScope);
  const models = modelsQuery.data ?? [];
  const settings = settingsQuery.data ?? null;
  const permissions = permissionsQuery.data ?? null;
  const pendingPermissionCategory = setPermissionForCategoryMutation.variables?.category ?? null;
  const threads = threadsQuery.data ?? [];

  const refreshSettings = useCallback(async () => {
    await settingsQuery.refetch();
  }, [settingsQuery]);

  const refreshThreads = useCallback(async () => {
    await threadsQuery.refetch();
  }, [threadsQuery]);

  useEffect(() => {
    if (!enabled) {
      // No active project — stay dormant, don't create a session or thread.
      setStatus('connecting');
      setController(null);
      setQuerySession(null);
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
      setController(controller);
      setQuerySession(session);

      try {
        const [created, agentControllerModes] = await Promise.all([
          // Scope initial thread selection to the active project so worktrees
          // sharing a resourceId each resume their own thread.
          session.create({ tags: projectPath ? { projectPath } : undefined }),
          controller.listModes(),
        ]);
        if (disposed) return;
        setModes(agentControllerModes);

        const state = await session.state();
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
  }, [agentControllerId, resourceId, baseUrl, projectPath, enabled]);

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

  const switchMode = useCallback(
    async (modeId: string) => {
      await switchModeMutation.mutateAsync(modeId);
    },
    [switchModeMutation],
  );

  const switchModel = useCallback(
    async (modelId: string) => {
      await switchModelMutation.mutateAsync(modelId);
    },
    [switchModelMutation],
  );

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
      const thread = await createThreadMutation.mutateAsync(title);
      dispatch({ type: 'reset', threadId: thread.id });
    },
    [createThreadMutation],
  );

  const deleteThread = useCallback(
    async (threadId: string) => {
      await deleteThreadMutation.mutateAsync(threadId);
    },
    [deleteThreadMutation],
  );

  const renameThread = useCallback(
    async (threadId: string, title: string) => {
      await renameThreadMutation.mutateAsync({ threadId, title });
    },
    [renameThreadMutation],
  );

  const cloneThread = useCallback(
    async (sourceThreadId?: string) => {
      const thread = await cloneThreadMutation.mutateAsync(sourceThreadId ? { sourceThreadId } : undefined);
      dispatch({ type: 'reset', threadId: thread.id });
    },
    [cloneThreadMutation],
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

  const setPermissionForCategory = useCallback(
    async (category: ToolCategory, policy: PermissionPolicy) => {
      await setPermissionForCategoryMutation.mutateAsync({ category, policy });
    },
    [setPermissionForCategoryMutation],
  );

  const setPermissionForTool = useCallback(async (toolName: string, policy: PermissionPolicy) => {
    await sessionRef.current?.setPermissionForTool(toolName, policy);
  }, []);

  const setState = useCallback(
    async (updates: Record<string, unknown>) => {
      await setStateMutation.mutateAsync(updates);
    },
    [setStateMutation],
  );

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
    permissions,
    pendingPermissionCategory,
    refreshSettings,
    setState,
    pushNotice,
  };
}
