import type { ChannelHandler } from '@mastra/core/channels';
import type { Mastra } from '@mastra/core/mastra';
import { SlackProvider } from '@mastra/slack';
import { Card, CardText, Actions, LinkButton } from 'chat';

/** Dependencies the Slack channel handlers close over, injected from the web entry. */
interface SlackChannelDeps {
  /**
   * Accessor for the server-owned Mastra instance. Lazy (not the instance
   * itself) because the provider is constructed inside the `new Mastra(...)`
   * literal — the instance doesn't exist yet at construction, only later when
   * a handler actually fires.
   */
  getMastra: () => Mastra;
}

/**
 * Build the "new session" handler for mention / direct-message events. A mention or
 * DM on a not-yet-subscribed thread starts a NEW session; once subscribed, later
 * events are follow-ups and don't re-announce.
 */
function createNewSessionChatHandler({ getMastra }: SlackChannelDeps): ChannelHandler {
  return async (thread, message, defaultHandler) => {
    // A mention on a not-yet-subscribed thread is a NEW session. The
    // default handler auto-subscribes, so once subscribed this is a
    // follow-up mention — don't re-announce.
    const isNewSession = !(await thread.isSubscribed());

    // Run the framework handler first so the internal Mastra thread and
    // controller session are created before we build the deep link.
    await defaultHandler(thread, message);

    if (!isNewSession) return;

    // The announcement card is only useful with a public origin to deep-link
    // to — otherwise the link would be `undefined/threads/...`. Without one the
    // session is still created; we skip the (broken) card and the lookup it
    // needs entirely.
    const publicUrl = process.env.MASTRACODE_PUBLIC_URL;
    if (!publicUrl) return;

    // The handler's `thread` is the Slack chat thread — its `.id` is the
    // platform thread id (e.g. `slack:C0BG...`), NOT the internal Mastra
    // thread UUID the web UI routes on. Look up the internal thread that
    // the framework created for this channel conversation via the stored
    // channel metadata, then build the link from its real id + resourceId.
    const store = await getMastra().getStorage()?.getStore('memory');
    const { threads } = (await store?.listThreads({
      filter: {
        metadata: {
          channel_platform: thread.adapter.name,
          channel_externalThreadId: thread.id,
          channel_externalChannelId: thread.channelId,
        },
      },
      perPage: 1,
    })) ?? { threads: [] };

    const internalThread = threads[0];
    if (!internalThread) {
      console.warn('[onMention] no internal thread found for', thread.id);
      return;
    }

    await thread.post(
      Card({
        title: 'New Mastra Code session started.',
        children: [
          CardText('A new session has been created.'),
          Actions([
            LinkButton({
              url: `${publicUrl}/threads/${internalThread.id}?resourceId=${encodeURIComponent(
                internalThread.resourceId,
              )}`,
              label: 'View Session',
            }),
          ]),
        ],
      }),
    );
  };
}

/** Construct the Slack channel provider wired to the server-owned Mastra instance. */
export function createSlackChannelProvider({ getMastra }: SlackChannelDeps): SlackProvider {
  const newSessionChatHandler = createNewSessionChatHandler({ getMastra });

  return new SlackProvider({
    refreshToken: process.env.SLACK_APP_REFRESH_TOKEN,
    baseUrl: process.env.MASTRACODE_PUBLIC_URL,
    handlers: {
      onSubscribedMessage: async (thread, message, defaultHandler) => {
        // `aside` as its own leading word lets humans talk in a subscribed
        // thread without the bot replying. Word boundary so messages that
        // merely start with "aside..." (e.g. "asides can wait") still route.
        if (/^aside\b/i.test(message.text)) return;
        return defaultHandler(thread, message);
      },
      onMention: newSessionChatHandler,
      onDirectMessage: newSessionChatHandler,
    },
  });
}
