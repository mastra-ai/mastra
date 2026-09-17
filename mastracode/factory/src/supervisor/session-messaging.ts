import type { RequestContext } from '@mastra/core/request-context';

type WorkerSession = {
  sendMessage(input: { content: string; requestContext?: RequestContext }): Promise<unknown>;
  queueMessage(input: { content: string; requestContext?: RequestContext }): Promise<unknown>;
};

type WorkerSessionController = {
  getSessionByResource(sessionId: string): Promise<WorkerSession | undefined>;
};

export async function messageWorkerSession({
  controller,
  sessionId,
  message,
  delivery,
  requestContext,
}: {
  controller: WorkerSessionController;
  sessionId: string;
  message: string;
  delivery: 'send' | 'queue';
  requestContext?: RequestContext;
}): Promise<void> {
  const session = await controller.getSessionByResource(sessionId);
  if (!session) throw new Error('The worker session is not currently available.');

  const input = { content: message, ...(requestContext ? { requestContext } : {}) };
  if (delivery === 'queue') {
    await session.queueMessage(input);
  } else {
    await session.sendMessage(input);
  }
}
