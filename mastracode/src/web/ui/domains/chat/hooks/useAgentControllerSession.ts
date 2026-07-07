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
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { queryKeys } from '../../../../../shared/api/keys';
import { initialTranscript, transcriptReducer } from '../services/transcript';
import type { TranscriptState } from '../services/transcript';
import {
  useAgentControllerModelsQuery,
  useAgentControllerPermissionsQuery,
  useAgentControllerSettingsQuery,
  useAgentControllerThreadMessagesQuery,
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
  /** Rebind the session to a thread. Rethrows on failure so callers (route sync) can react. */
  switchThread: (threadId: string) => Promise<void>;
  /** Create a new thread and bind the session to it. Resolves with the new thread id. */
  createThread: (title?: string) => Promise<string>;
  deleteThread: (threadId: string) => Promise<void>;
  renameThread: (threadId: string, title: string) => Promise<void>;
  /** Clone a thread (with messages) and bind to the clone. Resolves with the new thread id. */
  cloneThread: (sourceThreadId?: string) => Promise<string>;
  /** True while the bound thread's persisted history is loading. */
  messagesPending: boolean;
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
  // Mirrors the latest transcript so stable callbacks can read current values.
  const transcriptRef = useRef(transcript);
  transcriptRef.current = transcript;
  /**
   * Thread id whose persisted history has been folded into the transcript.
   * Guards the hydration effect so background refetches of the messages query
   * never clobber a transcript that is accumulating live stream events.
   */
  const hydratedThreadRef = useRef<string | undefined>(undefined);
  const queryClient = useQueryClient();

  const queryScope = { agentControllerId, resourceId };
  const modelsQuery = useAgentControllerModelsQuery(controller, enabled, { agentControllerId });
  const settingsQuery = useAgentControllerSettingsQuery(querySession, enabled, queryScope);
  const permissionsQuery = useAgentControllerPermissionsQuery(querySession, enabled, queryScope);
  const threadsQuery = useAgentControllerThreadsQuery(querySession, projectPath, enabled, queryScope);
  const messagesQuery = useAgentControllerThreadMessagesQuery(querySession, transcript.threadId, enabled, queryScope);
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

  const messagesPending = Boolean(transcript.threadId) && messagesQuery.isPending;

  // Fold persisted history into the transcript exactly once per thread binding.
  // Live SSE events layer on top afterwards; a running turn defers hydration so
  // the query can never clobber an in-flight stream.
  const messagesData = messagesQuery.data;
  useEffect(() => {
    const threadId = transcript.threadId;
    if (!threadId || !messagesData) return;
    if (hydratedThreadRef.current === threadId) return;
    if (transcript.running || transcript.pending) return;
    hydratedThreadRef.current = threadId;
    dispatch({ type: 'hydrateMessages', messages: messagesData, threadId });
  }, [messagesData, transcript.threadId, transcript.running, transcript.pending]);

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
      hydratedThreadRef.current = undefined;
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
        // Re-sync authoritative state. Events streamed during the disconnect
        // are lost, so drop the cached history and clear the hydration guard:
        // the messages query refetches and the hydration effect re-applies the
        // persisted history on top of the reset transcript.
        try {
          const state = await session.state();
          if (disposed) return;
          dispatch({
            type: 'reset',
            modeId: state.modeId,
            modelId: state.modelId,
            threadId: state.threadId,
            omProgress: state.omProgress,
            usage: state.tokenUsage,
          });
          hydratedThreadRef.current = undefined;
          queryClient.removeQueries({
            queryKey: queryKeys.agentControllerThreadMessages(agentControllerId, resourceId, state.threadId),
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
      const client = new MastraClient({ baseUrl, credentials: 'include' });
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
        if (disposed) return;
        // Bind the transcript to the resumed thread; the messages query loads
        // its persisted history and the hydration effect folds it in.
        const threadId = created.threadId ?? state.threadId;
        dispatch({
          type: 'reset',
          modeId: state.modeId,
          modelId: state.modelId,
          threadId,
          omProgress: state.omProgress,
          usage: state.tokenUsage,
        });

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
    // Optimistically reflect the switch so the UI responds immediately; the
    // messages query loads the thread's history (it isn't replayed over the
    // event stream) and the hydration effect folds it in.
    const prev = transcriptRef.current;
    // Force re-hydration even if this thread was visited before — the reset
    // below clears any previously applied history.
    hydratedThreadRef.current = undefined;
    dispatch({ type: 'reset', threadId, modeId: prev.modeId, modelId: prev.modelId });
    try {
      await session.switchThread(threadId);
      // Patch mode/model/usage from authoritative state WITHOUT touching the
      // timeline: the messages query may already have hydrated the thread's
      // history by the time this resolves, and a reset here would wipe it.
      const state = await session.state();
      dispatch({
        type: 'syncState',
        modeId: state.modeId,
        modelId: state.modelId,
        omProgress: state.omProgress,
        usage: state.tokenUsage,
      });
    } catch (err) {
      // Unbind the transcript (the server is still on the previous thread) so
      // route sync can settle on /new without redirect loops.
      dispatch({ type: 'reset', modeId: prev.modeId, modelId: prev.modelId, usage: prev.usage, omProgress: prev.omProgress });
      dispatch({ type: 'localNotice', level: 'error', text: `Failed to switch thread: ${errorText(err)}` });
      throw err;
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
      hydratedThreadRef.current = undefined;
      const prev = transcriptRef.current;
      dispatch({ type: 'reset', threadId: thread.id, modeId: prev.modeId, modelId: prev.modelId });
      return thread.id;
    },
    [createThreadMutation],
  );

  const deleteThread = useCallback(
    async (threadId: string) => {
      await deleteThreadMutation.mutateAsync(threadId);
      // Deleting the bound thread unbinds the session server-side — mirror
      // that locally so the UI (and route sync) treats the session as unbound.
      const prev = transcriptRef.current;
      if (prev.threadId === threadId) {
        dispatch({ type: 'reset', modeId: prev.modeId, modelId: prev.modelId });
      }
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
      hydratedThreadRef.current = undefined;
      const prev = transcriptRef.current;
      dispatch({ type: 'reset', threadId: thread.id, modeId: prev.modeId, modelId: prev.modelId });
      return thread.id;
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
    messagesPending,
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
