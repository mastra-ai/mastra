import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useApiConfig } from '../../../../../shared/api/config';
import { INITIAL_THREAD_MESSAGE_LIMIT, queryKeys } from '../../../../../shared/api/keys';
import { useToast } from '../../../ui/toast';
import { useWebAuth } from '../../../../../shared/hooks/useWebAuth';
import { userSessionResourceId } from '../../auth/services/auth';
import { createAgentControllerClient, requireAgentControllerSession } from '../../chat/services/agentControllerClient';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { useActiveFactoryContext } from '../context/ActiveFactoryProvider';
import { useWorkspaceActivity } from '../../../../../shared/hooks/useWorkspaceActivity';
import { useWorkspaceAttention } from '../../../../../shared/hooks/useWorkspaceAttention';
import { createWorktree, deleteWorktree } from '../services/github';
import type { Factory, Worktree } from '../services/factories';
import {
  isServerFactory,
  loadFactories,
  removeWorktree,
  selectedRepository,
  upsertWorktree,
  USER_SESSION_BRANCH_PREFIX,
  userSessionWorktrees,
} from '../services/factories';
import { WorkspaceRow } from './WorkspacesSection';

function latestFactory(factory: Factory): Factory {
  return loadFactories().find(stored => stored.id === factory.id) ?? factory;
}

function sessionLabel(worktree: Worktree): string {
  return worktree.branch.startsWith(USER_SESSION_BRANCH_PREFIX)
    ? worktree.branch.slice(USER_SESSION_BRANCH_PREFIX.length)
    : worktree.branch;
}

/**
 * Personal (non-factory) sessions for the current user on a GitHub project.
 *
 * Each session is its own worktree branched from the repo's HEAD (branch
 * `user/<name>`), holding exactly one conversation under the user's own
 * resourceId — so a user can run several personal sessions in parallel
 * without touching the org-level factory sessions. Opening a session
 * navigates to `/user/threads/<threadId>`, where the chat binds to the
 * user-scoped session (and modes stay available).
 */
export function UserSessionsSection() {
  const { baseUrl } = useApiConfig();
  const { activeFactory } = useActiveFactoryContext();
  const auth = useWebAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Worktree | null>(null);

  const isServer = activeFactory ? isServerFactory(activeFactory) : false;
  const hasRepository = activeFactory ? !!selectedRepository(activeFactory) : false;
  const sessionsEnabled = isServer && hasRepository;
  const userResourceId = userSessionResourceId(auth.data);

  const sessionsQuery = useQuery({
    queryKey: queryKeys.userSessions(activeFactory?.id),
    queryFn: async (): Promise<Worktree[]> => {
      if (!activeFactory) throw new Error('User sessions require an active factory');
      return userSessionWorktrees(latestFactory(activeFactory));
    },
    enabled: sessionsEnabled,
    initialData:
      sessionsEnabled && activeFactory ? () => userSessionWorktrees(latestFactory(activeFactory)) : undefined,
  });
  const worktrees = sessionsQuery.data ?? [];

  const runningByPath = useWorkspaceActivity({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId: userResourceId,
    scope: worktrees[0]?.worktreePath,
    worktreePaths: worktrees.map(worktree => worktree.worktreePath),
    baseUrl,
    enabled: sessionsEnabled && !auth.isPending && worktrees.length > 0,
  });
  const { attentionByPath, clearAttention } = useWorkspaceAttention(runningByPath);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.userSessions(activeFactory?.id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
  };

  // Seed (or address) the user's own session for a worktree: sessions are
  // scoped per worktree, under the user's resourceId rather than the org's.
  const userSessionFor = (worktreePath: string) => {
    const { session } = createAgentControllerClient({
      agentControllerId: AGENT_CONTROLLER_ID,
      resourceId: userResourceId,
      scope: worktreePath,
      baseUrl,
    });
    return requireAgentControllerSession(session);
  };

  const createSession = useMutation({
    mutationFn: async (rawName: string) => {
      if (!activeFactory || !isServerFactory(activeFactory)) throw new Error('No server-backed factory selected');
      const repository = selectedRepository(activeFactory);
      if (!repository) throw new Error('Link a repository to this factory first');
      const slug = rawName.trim().toLowerCase().replace(/\s+/g, '-');
      if (!slug) throw new Error('Session name is required');
      // A fresh worktree branched from the repo's HEAD (server defaults the
      // base branch), owned by this user.
      const result = await createWorktree(
        baseUrl,
        repository.projectRepositoryId,
        `${USER_SESSION_BRANCH_PREFIX}${slug}`,
      );
      const chatSession = userSessionFor(result.worktreePath);
      await chatSession.create({ tags: { projectPath: result.worktreePath } });
      const thread = await chatSession.createThread();
      upsertWorktree(latestFactory(activeFactory), {
        branch: result.branch,
        worktreePath: result.worktreePath,
        baseBranch: result.baseBranch,
        threadId: thread.id,
      });
      // A fresh thread has no messages; seed the cache to skip the skeleton.
      queryClient.setQueryData(
        queryKeys.agentControllerThreadMessages(
          AGENT_CONTROLLER_ID,
          userResourceId,
          thread.id,
          INITIAL_THREAD_MESSAGE_LIMIT,
        ),
        [],
      );
      return thread.id;
    },
    onSuccess: threadId => {
      setCreating(false);
      setName('');
      invalidate();
      void navigate(`/user/threads/${threadId}`);
    },
  });

  const deleteSession = useMutation({
    mutationFn: async (worktree: Worktree) => {
      if (!activeFactory || !isServerFactory(activeFactory)) throw new Error('No server-backed factory selected');
      const repository = selectedRepository(activeFactory);
      if (!repository) throw new Error('Link a repository to this factory first');
      await deleteWorktree(baseUrl, repository.projectRepositoryId, worktree.branch);
      // Cascade: delete the user's threads scoped to this worktree. Re-list
      // between rounds (page-size cap); bail after a sane number of rounds.
      const chatSession = userSessionFor(worktree.worktreePath);
      for (let round = 0; round < 20; round++) {
        const threads = await chatSession.listThreads({ limit: 50, tags: { projectPath: worktree.worktreePath } });
        if (threads.length === 0) break;
        for (const thread of threads) await chatSession.deleteThread(thread.id);
      }
      removeWorktree(latestFactory(activeFactory), worktree.worktreePath);
      return worktree;
    },
    onSuccess: worktree => {
      setConfirmDelete(null);
      invalidate();
      toast('Session deleted');
      if (worktree.threadId && location.pathname === `/user/threads/${worktree.threadId}`) {
        void navigate('/new', { replace: true });
      }
    },
    onError: error => {
      setConfirmDelete(null);
      toast(error instanceof Error ? error.message : 'Failed to delete session', 'error');
    },
  });

  if (!sessionsEnabled) return null;

  const pending = createSession.isPending || deleteSession.isPending;

  const openSession = async (worktree: Worktree) => {
    clearAttention(worktree.worktreePath);
    if (worktree.threadId) {
      void navigate(`/user/threads/${worktree.threadId}`);
      return;
    }
    // Legacy user worktree without a recorded thread: create one now so the
    // route can resolve back to this worktree.
    try {
      const chatSession = userSessionFor(worktree.worktreePath);
      await chatSession.create({ tags: { projectPath: worktree.worktreePath } });
      const thread = await chatSession.createThread();
      if (activeFactory) upsertWorktree(latestFactory(activeFactory), { ...worktree, threadId: thread.id });
      invalidate();
      void navigate(`/user/threads/${thread.id}`);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to open session', 'error');
    }
  };

  const resetCreate = () => {
    setCreating(false);
    setName('');
  };

  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim()) createSession.mutate(name);
  };

  const onCreateKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') resetCreate();
    if (event.key === 'Enter') {
      event.preventDefault();
      if (name.trim()) createSession.mutate(name);
    }
  };

  return (
    <section className="flex flex-col gap-2" aria-label="User sessions">
      <div className="flex items-center justify-between px-1">
        <Txt as="span" variant="ui-xs" className="text-icon3 uppercase tracking-wide">
          User Sessions
        </Txt>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="New user session"
          onClick={() => setCreating(true)}
          disabled={creating || pending}
        >
          <Plus size={15} />
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        {worktrees.map(worktree => {
          const active = Boolean(worktree.threadId) && location.pathname === `/user/threads/${worktree.threadId}`;
          return (
            <WorkspaceRow
              key={worktree.worktreePath}
              worktree={worktree}
              label={sessionLabel(worktree)}
              active={active}
              running={runningByPath[worktree.worktreePath] === true}
              attention={attentionByPath[worktree.worktreePath] === true}
              disabled={pending}
              onSelect={() => void openSession(worktree)}
              onDelete={() => setConfirmDelete(worktree)}
            />
          );
        })}

        {worktrees.length === 0 && !creating && (
          <Txt as="p" variant="ui-xs" className="m-0 px-2 py-1 text-icon3">
            No sessions yet
          </Txt>
        )}

        {creating && (
          <form aria-label="Create user session" className="flex flex-col gap-1" onSubmit={submitCreate}>
            <Input
              aria-label="Session name"
              autoFocus
              value={name}
              onChange={event => setName(event.target.value)}
              onKeyDown={onCreateKeyDown}
              placeholder="session-name"
              disabled={createSession.isPending}
              className="h-8 text-xs"
            />
            {createSession.error && (
              <Txt as="p" variant="ui-xs" className="m-0 text-red-400">
                {createSession.error instanceof Error ? createSession.error.message : 'Failed to create session'}
              </Txt>
            )}
          </form>
        )}
      </div>

      {confirmDelete && (
        <Dialog open onOpenChange={open => !open && setConfirmDelete(null)}>
          <DialogContent className="w-full max-w-sm" aria-label="Delete user session">
            <DialogHeader className="px-5 pt-4 pb-2">
              <DialogTitle>Delete session?</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 px-5 pb-4">
              <Txt as="p" variant="ui-sm" className="m-0 text-icon4">
                This deletes the <span className="text-icon6">{sessionLabel(confirmDelete)}</span> session, its checkout
                with any uncommitted changes, and its conversation. This can’t be undone.
              </Txt>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setConfirmDelete(null)} disabled={deleteSession.isPending}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="bg-red-600 text-white hover:bg-red-500"
                  onClick={() => deleteSession.mutate(confirmDelete)}
                  disabled={deleteSession.isPending}
                >
                  {deleteSession.isPending ? 'Deleting…' : 'Delete'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
