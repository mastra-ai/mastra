import type { MountedMastraCode } from '@mastra/code-sdk';
import { createBackgroundNoticeDelivery } from '@mastra/code-sdk/agents/background-completion';
import type { BackgroundNoticeDelivery, BackgroundNoticeTarget } from '@mastra/code-sdk/agents/background-completion';
import { RequestContext } from '@mastra/core/request-context';

/**
 * Delivers background command exit notices to Factory sessions, through Mastra Code's delivery. Factory
 * registers sessions by session id, and a session's other threads only name it in their stamp, so the
 * session is found the way a wake finds it. A woken run has no inbound request, so it runs as the session
 * row's owner like every Factory wake; when that owner can't be resolved the notice is saved to the thread.
 */
export function createFactoryBackgroundNoticeDelivery({
  getController,
  resolveWakeSession,
  prepareWakeRequestContext,
}: {
  /** Resolved per notice: the controller exists only once the Factory is mounted. */
  getController: () => Pick<MountedMastraCode['controller'], 'getSession' | 'queryThreadById'> | undefined;
  resolveWakeSession: (target: BackgroundNoticeTarget) => Promise<{ sessionId: string; row: unknown }>;
  prepareWakeRequestContext: (
    input: BackgroundNoticeTarget & { requestContext: RequestContext; reportFailure?: boolean },
  ) => Promise<void>;
}): BackgroundNoticeDelivery {
  const delivery = createBackgroundNoticeDelivery(
    () => ({ getSession: async sessionId => getController()?.getSession(sessionId) }),
    {
      resolveSession: async target => {
        const controller = getController();
        if (!controller) return undefined;
        const { sessionId, row } = await resolveWakeSession(target);
        // No session owns the thread (a forged stamp, a resource it moved off): drop the notice, so junk can't
        // push real ones out of the held queue. A session that owns it but isn't live gets it once it is.
        if (!row) return null;
        return controller.getSession(sessionId);
      },
      // Resolves the session a second time: the shared wake preparation stays exactly what every other Factory
      // wake runs. Its failure report is for runs that were lost; this notice is saved to its thread instead.
      wakeRequestContext: async (_session, target) => {
        const requestContext = new RequestContext();
        return prepareWakeRequestContext({ ...target, requestContext, reportFailure: false }).then(
          () => requestContext,
          () => undefined,
        );
      },
    },
  );
  return {
    async deliver(target, signal) {
      // A command's exit names the resource its thread had when the command started. Sharing a session or
      // making it private moves its threads, so the stored thread says where the notice goes now.
      const thread = await getController()?.queryThreadById({ threadId: target.threadId });
      const current = thread?.resourceId ? { ...target, resourceId: thread.resourceId } : target;
      return delivery.deliver(current, signal);
    },
    flush: () => delivery.flush(),
  };
}
