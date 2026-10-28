import { createOpenAI } from '@ai-sdk/openai-v5';
import { expect, it } from 'vitest';
import { Agent } from '../../../../agent';
import { createDurableAgent, createEventedAgent } from '../../../../agent/durable';
import { AgentThreadStreamRuntime } from '../../../../agent/thread-stream-runtime';
import { EventEmitterPubSub } from '../../../../events';
import { Mastra } from '../../../../mastra';
import { dispatchDueNotifications } from '../../../../notifications/dispatcher';
import { InMemoryNotificationsStorage } from '../../../../notifications/storage';
import { InMemoryStore, MastraCompositeStore } from '../../../../storage';
import { describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

// Drop only owner-discovery responses, not presence adverts or agent/workflow events.
// This models an advertised peer whose discovery response cannot reach the sender.
class DiscoveryPubSub extends EventEmitterPubSub {
  ownerAnswersDiscovery = true;

  override async publish(...args: Parameters<EventEmitterPubSub['publish']>): Promise<void> {
    const [topic, event] = args;
    if (
      !this.ownerAnswersDiscovery &&
      topic.startsWith('agent.thread-owner-discovery') &&
      event.data?.type === 'thread-owner-response'
    ) {
      return;
    }
    await super.publish(...args);
  }
}

// Local peer/runtime control is intentional; these fixtures do not model an external Inngest worker or fs routing.
describeForAllEngines(
  'AIMock loop scenario: claimed-owner notification delivery',
  engine => {
    const getMock = useLoopScenarioAimock();

    for (const delivery of ['individual', 'summary'] as const) {
      // #27347: delayed individual delivery and grouped summaries must retain the owner fence.
      it(`keeps ${delivery} notifications pending until the claimed owner responds`, async () => {
        const llm = getMock();
        llm.on({ endpoint: 'chat' }, { content: 'Owner handled the notification.' });
        const pubsub = new DiscoveryPubSub();
        const notifications = new InMemoryNotificationsStorage();
        const storage = new MastraCompositeStore({
          id: `notification-owner-${engine}-${delivery}`,
          default: new InMemoryStore(),
          domains: { notifications },
        });
        const completed = Promise.withResolvers<void>();
        const makeAgent = (identity: 'owner' | 'sender') => {
          const agent = new Agent({
            id: `${identity}-${engine}-${delivery}`,
            name: identity,
            instructions:
              identity === 'owner' ? 'OWNER WORKSPACE: handle notifications.' : 'SENDER WORKSPACE: must not execute.',
            model: createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url}/v1` })(SCENARIO_MODEL_ID),
            pubsub,
            ...(delivery === 'summary'
              ? {
                  notifications: {
                    deliveryPolicy: {
                      default: { action: 'summarize' as const, summaryAt: new Date(Date.now() + 30_000) },
                    },
                  },
                }
              : {}),
          });
          // Dispatch runs on a plain local client; the claimed owner's execution engine varies.
          if (identity === 'sender') return agent;
          return engine === 'durable'
            ? createDurableAgent({ agent, pubsub })
            : engine === 'evented'
              ? createEventedAgent({ agent, pubsub })
              : agent;
        };
        const owner = makeAgent('owner');
        const sender = makeAgent('sender');
        const ownerHost = new Mastra({ agents: { owner }, storage: new InMemoryStore(), pubsub, logger: false });
        const senderHost = new Mastra({ agents: { sender }, storage, pubsub, logger: false });
        const target = { resourceId: `resource-${engine}-${delivery}`, threadId: `thread-${engine}-${delivery}` };
        const ownerRuntime = new AgentThreadStreamRuntime();
        const claim = await ownerRuntime.claimThreadOwnership(
          owner,
          {
            ...target,
            streamOptions: {
              untilIdle: true,
              onFinish: () => {
                completed.resolve();
              },
            },
          },
          pubsub,
        );
        try {
          pubsub.ownerAnswersDiscovery = false;
          const sent = await sender.sendNotificationSignal(
            {
              source: 'calendar',
              kind: 'reminder',
              summary: 'Review the pending invoice.',
              priority: delivery === 'summary' ? 'medium' : 'high',
            },
            { ...target, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
          );
          const requiredId = sent.record.id;
          expect(sent.accepted).toBeUndefined();
          if (delivery === 'summary') {
            // A mixed batch must inherit the requirement from ANY member, not only its first record.
            await sender.sendNotificationSignal(
              { source: 'calendar', kind: 'reminder', summary: 'Another invoice.', priority: 'high' },
              target,
            );
          }
          const before = await notifications.getNotification({ ...target, id: requiredId });
          expect(before).toMatchObject({ status: 'pending' });
          if (delivery === 'individual') expect(before?.deliverAt).toBeInstanceOf(Date);
          const failed = await dispatchDueNotifications({
            mastra: senderHost,
            storage: notifications,
            now: new Date(Date.now() + 60_000),
          });
          expect(failed.delivered).toEqual([]);
          expect(failed.failed).toHaveLength(delivery === 'summary' ? 2 : 1);
          expect(failed.failed.every(item => item.error.includes('No claimed thread owner responded'))).toBe(true);
          expect(await notifications.getNotification({ ...target, id: requiredId })).toMatchObject({
            status: 'pending',
            deliveryAttempts: (before?.deliveryAttempts ?? 0) + 1,
          });
          expect(llm.getRequests()).toHaveLength(0);

          pubsub.ownerAnswersDiscovery = true;
          const delivered = await dispatchDueNotifications({
            mastra: senderHost,
            storage: notifications,
            now: new Date(Date.now() + 120_000),
          });
          expect(delivered.failed).toEqual([]);
          expect(delivered.delivered).toHaveLength(delivery === 'summary' ? 2 : 1);
          await completed.promise;
          expect(llm.getRequests()).toHaveLength(1);
          const request = JSON.stringify(llm.getRequests()[0].body.messages);
          expect(request).toContain('OWNER WORKSPACE');
          expect(request).not.toContain('SENDER WORKSPACE');
          expect(request).toContain(
            delivery === 'summary' ? 'calendar: 2</notification-summary>' : 'Review the pending invoice.',
          );
          const record = await notifications.getNotification({ ...target, id: requiredId });
          if (delivery === 'individual') expect(record?.deliveredSignalId).toBeTruthy();
          else expect(record?.summarySignalId).toBeTruthy();
        } finally {
          await claim.unsubscribe();
          await senderHost.shutdown();
          await ownerHost.shutdown();
          await pubsub.close();
        }
      }, 30_000);
    }
  },
  { skip: ['fs', 'inngest'] },
);
