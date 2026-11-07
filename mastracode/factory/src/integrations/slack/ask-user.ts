import type { ActionChannelHandler, ChannelHandlers, ChannelSessionStart } from '@mastra/core/channels';
import type { Mastra } from '@mastra/core/mastra';
import type { createSlackAdapter } from '@mastra/slack';
import { Actions, Button, Card, CardText, Modal, TextInput } from 'chat';

const CARD_KEY = 'factory_slack_ask_user:';
const RUN_KEY = 'factory_slack_ask_user_run:';
const ACTION = 'factory_ask_user:';
const MODAL = 'factory_ask_user_custom';

type Session = Parameters<ChannelSessionStart>[0]['session'];
type Adapter = ReturnType<typeof createSlackAdapter>;
type ActionContext = Parameters<ActionChannelHandler>[2];
type ModalHandler = NonNullable<ChannelHandlers['onModalSubmit']>;
type Question = {
  runId: string;
  toolCallId: string;
  threadId: string;
  resourceId: string;
  requesterId: string;
  question: string;
  options: Array<{ label: string; description?: string }>;
  selectionMode: 'single_select' | 'multi_select';
  selected: number[];
};

function card(prompt: Question, outcome?: string) {
  return Card({
    title: 'Question',
    children: [
      CardText(prompt.question),
      ...prompt.options
        .filter(option => option.description)
        .map(option => CardText(`${option.label} — ${option.description}`)),
      ...(outcome
        ? [CardText(outcome)]
        : [
            Actions([
              ...prompt.options.map((option, index) =>
                Button({
                  id: `${ACTION}option:${index}`,
                  label: `${prompt.selected.includes(index) ? '✓ ' : ''}${option.label}`,
                }),
              ),
              Button({ id: `${ACTION}custom`, label: 'Other…', actionType: 'modal' }),
              ...(prompt.selectionMode === 'multi_select' ? [Button({ id: `${ACTION}submit`, label: 'Submit' })] : []),
            ]),
          ]),
    ],
  });
}

// Factory's web package and core can resolve different Chat SDK versions. Their
// card declarations disagree on private members, but serialize to the same AST.
function postable(prompt: Question, outcome?: string): Parameters<Adapter['postMessage']>[1] {
  return card(prompt, outcome) as Parameters<Adapter['postMessage']>[1];
}

async function requester(session: Session, threadId: string): Promise<string | undefined> {
  const messages = await session.thread.listMessages({ threadId, limit: 50 });
  const latest = [...messages].reverse().find(message => message.role === 'user');
  return (
    latest?.content?.providerMetadata?.mastra as { channels?: { slack?: { author?: { userId?: string } } } } | undefined
  )?.channels?.slack?.author?.userId;
}

/** Observe the channel session before its first signal starts. */
export function watchSlackQuestions(session: Session, adapter: Adapter): void {
  session.subscribe(event => {
    if (event.type !== 'tool_suspended' && event.type !== 'tool_suspension_cancelled') return;
    void (async () => {
      const threadId = event.threadId ?? session.thread.getId();
      if (!threadId) return;
      const thread = await session.thread.getById({ threadId });
      const externalId = thread?.metadata?.channel_externalThreadId;
      if (typeof externalId !== 'string' || thread?.metadata?.channel_platform !== 'slack') return;
      const runKey = RUN_KEY + event.runId + ':' + event.toolCallId;
      if (event.type === 'tool_suspension_cancelled') {
        const messageId = (await session.thread.getSettingOn({ threadId, key: runKey })) as string | undefined;
        if (!messageId) return;
        const prompt = (await session.thread.getSettingOn({ threadId, key: CARD_KEY + messageId })) as
          Question | undefined;
        if (!prompt) return;
        await adapter.editMessage(externalId, messageId, postable(prompt, 'Question cancelled.'));
        await session.thread.setSettingOn({ threadId, key: CARD_KEY + messageId, value: undefined });
        await session.thread.setSettingOn({ threadId, key: runKey, value: undefined });
        return;
      }
      if (event.toolName !== 'ask_user' || !event.runId) return;
      const payload = event.suspendPayload as
        | {
            question?: string;
            options?: Array<{ label: string; description?: string }>;
            selectionMode?: 'single_select' | 'multi_select';
          }
        | undefined;
      if (!payload?.question) return;
      const authorId = await requester(session, threadId);
      if (!authorId) return;
      const prompt: Question = {
        runId: event.runId,
        toolCallId: event.toolCallId,
        threadId,
        resourceId: event.resourceId ?? session.identity.getResourceId(),
        requesterId: authorId,
        question: payload.question,
        options: payload.options ?? [],
        selectionMode: payload.selectionMode ?? 'single_select',
        selected: [],
      };
      const posted = await adapter.postMessage(externalId, postable(prompt));
      await session.thread.setSettingOn({ threadId, key: CARD_KEY + posted.id, value: prompt });
      await session.thread.setSettingOn({ threadId, key: runKey, value: posted.id });
    })().catch(error => console.warn('[slack] ask_user card delivery failed', error));
  });
}

/** Resolve and answer a persisted Slack question, even after the controller restarts. */
export function slackQuestionHandlers(
  adapter: Adapter,
  resolveSession: (
    mastra: Mastra,
    thread: { id: string; resourceId: string; metadata?: Record<string, unknown> },
    ctx: ActionContext,
  ) => Promise<Session>,
): Pick<ChannelHandlers, 'onAction' | 'onModalSubmit'> {
  async function findQuestion(
    mastra: Mastra,
    externalId: string,
    channelId: string,
    messageId: string,
    ctx: ActionContext,
  ) {
    const store = await mastra.getStorage()?.getStore('memory');
    if (!store) return;
    const { threads } = await store.listThreads({
      filter: {
        metadata: {
          channel_platform: 'slack',
          channel_externalThreadId: externalId,
          channel_externalChannelId: channelId,
        },
      },
      perPage: 10,
    });
    for (const thread of threads) {
      const session = await resolveSession(mastra, thread, ctx);
      const prompt = (await session.thread.getSettingOn({ threadId: thread.id, key: CARD_KEY + messageId })) as
        Question | undefined;
      if (prompt?.threadId === thread.id && prompt.resourceId === thread.resourceId) return { session, prompt };
    }
  }

  async function answer(
    mastra: Mastra,
    externalId: string,
    channelId: string,
    messageId: string,
    actorId: string,
    value: string | string[],
    ctx: ActionContext,
    chatThread?: { id: string },
  ) {
    const found = await findQuestion(mastra, externalId, channelId, messageId, ctx);
    if (!found || found.prompt.requesterId !== actorId) return;
    const { session, prompt } = found;
    const claim = await session.claimPersistedToolSuspension(prompt.toolCallId, prompt.runId);
    if (!claim.accepted) return;
    try {
      if (chatThread)
        await ctx.prepareInteractiveReply?.(
          chatThread as Parameters<NonNullable<ActionContext['prepareInteractiveReply']>>[0],
          messageId,
          { userId: actorId },
          prompt.requesterId,
        );
      await session.respondToToolSuspension({
        address: claim.address,
        resumeData: value,
        requestContext: ctx.requestContext,
      });
      await adapter.editMessage(externalId, messageId, postable(prompt, 'Answered.'));
      await session.thread.setSettingOn({ threadId: prompt.threadId, key: CARD_KEY + messageId, value: undefined });
      await session.thread.setSettingOn({
        threadId: prompt.threadId,
        key: RUN_KEY + prompt.runId + ':' + prompt.toolCallId,
        value: undefined,
      });
    } finally {
      session.releaseToolResponse(claim.claimKey);
    }
  }

  return {
    onAction: async (event, defaultHandler, ctx) => {
      if (!event.actionId.startsWith(ACTION)) return defaultHandler();
      const externalId = event.thread?.id;
      const channelId = event.thread?.channelId;
      const messageId = event.messageId;
      const actorId = event.user?.userId;
      if (!externalId || !channelId || !messageId || !actorId || !ctx.mastra) return;
      const found = await findQuestion(ctx.mastra, externalId, channelId, messageId, ctx);
      if (!found || found.prompt.requesterId !== actorId) return;
      const { session, prompt } = found;
      if (event.actionId === `${ACTION}custom`) {
        await event.openModal(
          Modal({
            callbackId: MODAL,
            title: 'Your answer',
            privateMetadata: JSON.stringify({ externalId, channelId, messageId }),
            children: TextInput({ id: 'answer', label: 'Answer', multiline: true }),
          }),
        );
      } else if (event.actionId === `${ACTION}submit`) {
        if (prompt.selectionMode === 'multi_select' && prompt.selected.length) {
          await answer(
            ctx.mastra,
            externalId,
            channelId,
            messageId,
            actorId,
            prompt.selected.map(i => prompt.options[i]!.label),
            ctx,
            event.thread ?? undefined,
          );
        }
      } else if (event.actionId.startsWith(`${ACTION}option:`)) {
        const index = Number(event.actionId.slice(`${ACTION}option:`.length));
        if (!Number.isInteger(index) || index < 0 || index >= prompt.options.length) return;
        if (prompt.selectionMode === 'single_select') {
          await answer(
            ctx.mastra,
            externalId,
            channelId,
            messageId,
            actorId,
            prompt.options[index]!.label,
            ctx,
            event.thread ?? undefined,
          );
        } else {
          const selected = prompt.selected.includes(index)
            ? prompt.selected.filter(i => i !== index)
            : [...prompt.selected, index];
          const updated = { ...prompt, selected };
          await session.thread.setSettingOn({ threadId: prompt.threadId, key: CARD_KEY + messageId, value: updated });
          await adapter.editMessage(externalId, messageId, postable(updated));
        }
      }
    },
    onModalSubmit: async (event: Parameters<ModalHandler>[0], ctx: Parameters<ModalHandler>[1]) => {
      if (event.callbackId !== MODAL || !ctx.mastra || !event.privateMetadata) return;
      let data: { externalId?: string; channelId?: string; messageId?: string };
      try {
        data = JSON.parse(event.privateMetadata);
      } catch {
        return;
      }
      if (!data.externalId || !data.channelId || !data.messageId || event.relatedThread?.id !== data.externalId) return;
      const response = event.values.answer?.trim();
      if (!response) return;
      await answer(
        ctx.mastra,
        data.externalId,
        data.channelId,
        data.messageId,
        event.user.userId,
        response,
        ctx,
        event.relatedThread ?? undefined,
      );
    },
  };
}
