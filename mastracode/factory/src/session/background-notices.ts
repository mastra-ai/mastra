import type { MountedMastraCode } from '@mastra/code-sdk';
import { findSessionForThread } from '@mastra/code-sdk/agents/background-completion';
import type {
  BackgroundNoticeDelivery,
  BackgroundNoticeSignal,
  BackgroundNoticeTarget,
} from '@mastra/code-sdk/agents/background-completion';
import { RequestContext } from '@mastra/core/request-context';

import { prepareSessionRunContext } from '../integrations/subscription-session.js';
import type { SubscriptionSessionLookup } from '../integrations/subscription-session.js';

// Exits that land while no session runs their thread wait for the next session; past this many the oldest go.
const MAX_HELD_NOTICES = 100;

type HeldNotice = { target: BackgroundNoticeTarget; signal: BackgroundNoticeSignal; wake: boolean };

/**
 * Delivers background command exit notices to Factory sessions. Like Mastra Code's delivery, it wakes the
 * session when it is on the notice's thread and saves the notice to the thread otherwise. A woken run has no
 * inbound request, so it runs as the session row's owner with that owner's credentials, as other Factory wakes do.
 */
export function createFactoryBackgroundNoticeDelivery({
  getController,
  sessions,
}: {
  /** Resolved per notice: the controller exists only once the Factory is mounted. */
  getController: () => Pick<MountedMastraCode['controller'], 'getSession'> | undefined;
  sessions: SubscriptionSessionLookup['sessions'];
}): BackgroundNoticeDelivery {
  const held: HeldNotice[] = [];
  const hold = (notice: HeldNotice) => {
    held.push(notice);
    if (held.length > MAX_HELD_NOTICES) held.shift();
  };

  const wakeContext = async (sessionId: string): Promise<RequestContext | undefined> => {
    const requestContext = new RequestContext();
    const prepared = await prepareSessionRunContext(requestContext, sessionId, { sessions }).catch(() => undefined);
    return prepared === 'prepared' ? requestContext : undefined;
  };

  const send = async ({ target, signal, wake }: HeldNotice): Promise<boolean> => {
    const controller = getController();
    if (!controller) return false;
    const session = await findSessionForThread(controller, target);
    if (!session) return false;
    if (wake && session.thread.getId() === target.threadId) {
      // Without the owner's identity the run could not resolve credentials or the workspace; save it instead.
      const requestContext = await wakeContext(session.identity.getId());
      const woken = requestContext
        ? await session
            .sendSignal(signal, { ifIdle: { behavior: 'wake' }, requireDelivery: true, requestContext })
            .accepted.catch(() => undefined)
        : undefined;
      if (woken && woken.action !== 'blocked' && woken.action !== 'discard') return true;
    }
    await session.sendSignalToThread(signal, target).accepted;
    return true;
  };

  return {
    async deliver(target, signal, options) {
      const notice = { target, signal, wake: options?.wake ?? true };
      let sent: boolean;
      try {
        sent = await send(notice);
      } catch (error) {
        hold(notice);
        throw error;
      }
      if (!sent) hold(notice);
    },
    async flush() {
      for (const notice of held.splice(0)) {
        const sent = await send(notice).catch(() => false);
        if (!sent) hold(notice);
      }
    },
  };
}
