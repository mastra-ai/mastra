import {
  AgentControllerChannels,
  type ChannelAccountLinkResolver,
  type ChannelHandler,
  type ChannelHandlers,
} from '@mastra/core/channels';
import type { Mastra } from '@mastra/core/mastra';
import type {
  ChannelAccountLink,
  ChannelAccountLinkKey,
  ChannelIdentityStorage,
  ChannelLinkStateSigner,
  FactoryProjectsStorage,
} from '@mastra/factory';
import { createSlackAdapter, SlackProvider } from '@mastra/slack';
import { Card, CardText, Actions, LinkButton } from 'chat';

// Derive the thread/message types from the core handler signature rather than
// importing them from `chat` directly: mc-web can resolve a different `chat`
// version than @mastra/core, and the two `Thread`/`Message` declarations are
// structurally incompatible (private fields). Using the handler's own types
// keeps everything on one version.
type HandlerThread = Parameters<ChannelHandler>[0];
type HandlerMessage = Parameters<ChannelHandler>[1];

/** Dependencies the Slack channel handlers close over, injected from the web entry. */
interface SlackChannelDeps {
  /**
   * Accessor for the server-owned Mastra instance. Lazy (not the instance
   * itself) because the provider is constructed inside the `new Mastra(...)`
   * literal — the instance doesn't exist yet at construction, only later when
   * a handler actually fires.
   */
  getMastra: () => Mastra | undefined;
  /**
   * The factory's reverse-index store mapping a Slack sender to a Mastra
   * tenant. When provided, inbound messages from an unlinked sender are not
   * dispatched — the run only proceeds (with the sender's tenant stamped on
   * the request context) once they've linked their account. Unlinked senders
   * get an ephemeral "connect your account" card instead.
   */
  accountLinks?: ChannelIdentityStorage;
  /**
   * Signs the account-linking deep-link `state` so a forged `?teamId=&userId=`
   * can't hijack a link. Required to render the Connect card; without it the
   * unlinked path silently skips (defense-in-depth still blocks the run).
   */
  channelLinkStateSigner?: ChannelLinkStateSigner;
  /**
   * Factory projects domain. When provided (alongside `accountLinks`), a
   * linked sender's run must also resolve to a Factory project before it
   * dispatches: their link's default factory, else their tenant's only
   * factory (stamped back onto the link), else an ephemeral "pick a default
   * factory" card and no run. Unset → no factory routing (runs dispatch as
   * before).
   */
  projects?: FactoryProjectsStorage;
}

/**
 * The Slack team id survives onto a normalized chat Message only on
 * `message.raw` (the Slack Events API envelope). Read it duck-typed to build
 * the workspace-scoped account-link key.
 */
function slackTeamId(message: HandlerMessage): string | undefined {
  const raw = message.raw as { team_id?: unknown; team?: unknown } | undefined;
  if (!raw || typeof raw !== 'object') return undefined;
  if (typeof raw.team_id === 'string' && raw.team_id) return raw.team_id;
  if (typeof raw.team === 'string' && raw.team) return raw.team;
  if (raw.team && typeof raw.team === 'object') {
    const id = (raw.team as { id?: unknown }).id;
    if (typeof id === 'string' && id) return id;
  }
  return undefined;
}

/** Resolve the public origin Slack's servers call back on (events/webhooks). */
function channelsPublicUrl(): string | undefined {
  return process.env.MASTRACODE_CHANNELS_PUBLIC_URL ?? process.env.MASTRACODE_PUBLIC_URL;
}

/**
 * Resolve the web-UI origin for links humans open in a browser (Connect card,
 * session deep links). Prefers `MASTRACODE_PUBLIC_URL` — the origin auth
 * cookies and OAuth redirect allow-lists are registered against — over the
 * channels tunnel, which only Slack's servers need to reach.
 */
function webPublicUrl(): string | undefined {
  return process.env.MASTRACODE_PUBLIC_URL ?? process.env.MASTRACODE_CHANNELS_PUBLIC_URL;
}

/** Outcome of the sender-link gate for one inbound message. */
export type LinkedSenderResult =
  /** Gating not configured — dispatch as before account linking existed. */
  | { status: 'ungated' }
  /** Sender unlinked — Connect card posted (when possible), do not dispatch. */
  | { status: 'blocked' }
  /** Sender linked — their tenant plus the sender key the link lives under. */
  | { status: 'linked'; link: ChannelAccountLink; key: ChannelAccountLinkKey };

/**
 * Resolve the sender's account link, posting an ephemeral "connect your
 * account" card (visible only to the sender) with a signed deep link into the
 * web UI's Slack-connect flow when they're unlinked.
 */
export async function resolveLinkedSender({
  thread,
  message,
  accountLinks,
  channelLinkStateSigner,
}: {
  thread: HandlerThread;
  message: HandlerMessage;
  accountLinks?: ChannelIdentityStorage;
  channelLinkStateSigner?: ChannelLinkStateSigner;
}): Promise<LinkedSenderResult> {
  if (!accountLinks) return { status: 'ungated' };
  const platform = thread.adapter.name;
  const externalUserId = message.author.userId;
  const externalTeamId = slackTeamId(message);
  // Without a team id we can't identify the workspace-scoped link; treat as
  // unlinked so a run never proceeds tenant-less.
  const key = externalTeamId ? { platform, externalTeamId, externalUserId } : undefined;
  const link = key ? await accountLinks.getAccountLink(key) : null;
  if (link && key) return { status: 'linked', link, key };

  const publicUrl = webPublicUrl();
  // Need both a signer (anti-spoofing) and a public origin to build a usable
  // Connect link. Missing either → still block the run, just no card.
  if (channelLinkStateSigner && publicUrl && externalTeamId) {
    const state = channelLinkStateSigner.sign({
      platform,
      externalTeamId,
      externalUserId,
      channelId: thread.channelId,
    });
    await thread.postEphemeral(
      message.author,
      Card({
        title: 'Connect your account',
        children: [
          CardText('Connect your account to use this agent.'),
          Actions([
            LinkButton({
              url: `${publicUrl}/connect/slack?state=${encodeURIComponent(state)}`,
              label: 'Connect account',
            }),
          ]),
        ],
      }),
      { fallbackToDM: true },
    );
  }
  return { status: 'blocked' };
}

/**
 * Boolean view of {@link resolveLinkedSender}: `true` when the sender is
 * unlinked (caller must not dispatch a run), `false` when they're linked or
 * when the check is not configured (dispatch as usual).
 */
export async function promptIfUnlinked(args: {
  thread: HandlerThread;
  message: HandlerMessage;
  accountLinks?: ChannelIdentityStorage;
  channelLinkStateSigner?: ChannelLinkStateSigner;
}): Promise<boolean> {
  return (await resolveLinkedSender(args)).status === 'blocked';
}

/** Outcome of factory routing for one linked sender's inbound message. */
export type FactoryRouteResult =
  /** Factory routing not configured — dispatch without a factory. */
  | { status: 'ungated' }
  /** No factory resolved — prompt card posted (when possible), do not dispatch. */
  | { status: 'blocked' }
  /** The Factory project this sender's runs route to. */
  | { status: 'resolved'; factoryProjectId: string };

/**
 * Decide which Factory project a linked sender's run belongs to:
 *
 * 1. The link's `defaultFactoryProjectId`, when it still exists (a stale id —
 *    deleted factory — falls through as if unset).
 * 2. Else, the tenant's only factory, stamped back onto the link so it shows
 *    up (and stays editable) in Connected Accounts settings.
 * 3. Else — zero or several factories — an ephemeral "pick a default factory"
 *    card deep-linking to settings, and the run is blocked.
 */
export async function resolveFactoryForLink({
  thread,
  message,
  link,
  key,
  accountLinks,
  projects,
}: {
  thread: HandlerThread;
  message: HandlerMessage;
  link: ChannelAccountLink;
  key: ChannelAccountLinkKey;
  accountLinks: ChannelIdentityStorage;
  projects?: FactoryProjectsStorage;
}): Promise<FactoryRouteResult> {
  if (!projects) return { status: 'ungated' };
  // Factories are org-scoped; a personal account (no org) has none and lands
  // on the prompt below.
  const orgId = link.orgId ?? '';

  if (link.defaultFactoryProjectId) {
    const existing = await projects.get({ orgId, id: link.defaultFactoryProjectId });
    if (existing) return { status: 'resolved', factoryProjectId: existing.id };
  }

  const factories = orgId ? await projects.list({ orgId }) : [];
  if (factories.length === 1) {
    const only = factories[0]!;
    await accountLinks.setDefaultFactory({ ...key, userId: link.userId, factoryProjectId: only.id });
    return { status: 'resolved', factoryProjectId: only.id };
  }

  const publicUrl = webPublicUrl();
  if (publicUrl) {
    await thread.postEphemeral(
      message.author,
      Card({
        title: 'Pick a default factory',
        children: [
          CardText(
            factories.length === 0
              ? 'Your account has no factory yet. Create one in the web app, then message me again.'
              : 'Your account has several factories. Pick which one Slack sessions should go to, then message me again.',
          ),
          Actions([
            LinkButton({
              url: `${publicUrl}/settings/connected-accounts`,
              label: 'Open settings',
            }),
          ]),
        ],
      }),
      { fallbackToDM: true },
    );
  }
  return { status: 'blocked' };
}

/**
 * Adapt the factory account-link store into the core resolver shape: map the
 * platform sender ids (`teamId`/`userId`) to the store's `external_*` key. A
 * missing `teamId` can't identify a workspace-scoped link, so treat it as
 * unlinked rather than matching across workspaces.
 */
function createAccountLinkResolver(accountLinks: ChannelIdentityStorage): ChannelAccountLinkResolver {
  return async ({ platform, teamId, userId }) => {
    if (!teamId) return null;
    const link = await accountLinks.getAccountLink({
      platform,
      externalTeamId: teamId,
      externalUserId: userId,
    });
    return link ? { orgId: link.orgId, userId: link.userId } : null;
  };
}

/**
 * Build the "new session" handler for mention / direct-message events. A mention or
 * DM on a not-yet-subscribed thread starts a NEW session; once subscribed, later
 * events are follow-ups and don't re-announce.
 */
function createNewSessionChatHandler({
  getMastra,
  accountLinks,
  channelLinkStateSigner,
  projects,
}: SlackChannelDeps): ChannelHandler {
  return async (thread, message, defaultHandler) => {
    // Gate on the sender having linked their Slack account to a Mastra tenant.
    // Unlinked → post the ephemeral Connect card and stop; no session/run is
    // created (which would otherwise be tenant-less and fail credential
    // resolution). The core dispatch seam enforces the same gate as a backstop.
    const sender = await resolveLinkedSender({ thread, message, accountLinks, channelLinkStateSigner });
    if (sender.status === 'blocked') return;
    // Linked senders must also route to a Factory project before a run starts.
    if (sender.status === 'linked' && accountLinks) {
      const route = await resolveFactoryForLink({ thread, message, ...sender, accountLinks, projects });
      if (route.status === 'blocked') return;
    }

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

    if (!process.env.MASTRACODE_PUBLIC_URL) return;

    // The handler's `thread` is the Slack chat thread — its `.id` is the
    // platform thread id (e.g. `slack:C0BG...`), NOT the internal Mastra
    // thread UUID the web UI routes on. Look up the internal thread that
    // the framework created for this channel conversation via the stored
    // channel metadata, then build the link from its real id + resourceId.
    const store = await getMastra()?.getStorage()?.getStore('memory');
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
              url: `${process.env.MASTRACODE_PUBLIC_URL}/threads/${internalThread.id}?resourceId=${encodeURIComponent(
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
export const createHandlers = (deps: SlackChannelDeps): ChannelHandlers => {
  const newSessionChatHandler = createNewSessionChatHandler(deps);
  const { accountLinks, channelLinkStateSigner, projects } = deps;

  return {
    onSubscribedMessage: async (thread, message, defaultHandler) => {
      // `aside` as its own leading word lets humans talk in a subscribed
      // thread without the bot replying. Word boundary so messages that
      // merely start with "aside..." (e.g. "asides can wait") still route.
      if (/^aside\b/i.test(message.text)) return;
      // A subscribed follow-up from an unlinked sender must not run either
      // (e.g. the link was removed mid-conversation), and it must still
      // resolve a factory (e.g. the default was cleared or its factory
      // deleted mid-conversation).
      const sender = await resolveLinkedSender({ thread, message, accountLinks, channelLinkStateSigner });
      if (sender.status === 'blocked') return;
      if (sender.status === 'linked' && accountLinks) {
        const route = await resolveFactoryForLink({ thread, message, ...sender, accountLinks, projects });
        if (route.status === 'blocked') return;
      }
      return defaultHandler(thread, message);
    },
    onMention: newSessionChatHandler,
    onDirectMessage: newSessionChatHandler,
  };
};

/** Construct the Slack channel provider wired to the server-owned Mastra instance. */
export function createSlackChannelProvider(deps: SlackChannelDeps): SlackProvider {
  return new SlackProvider({
    refreshToken: process.env.SLACK_APP_REFRESH_TOKEN,
    baseUrl: channelsPublicUrl(),
    handlers: createHandlers(deps),
    toolDisplay: 'hidden',
  });
}

export function createAgentControllerSlackChannels(deps: SlackChannelDeps): AgentControllerChannels {
  const { accountLinks } = deps;
  const channels = new AgentControllerChannels({
    adapters: {
      slack: {
        adapter: createSlackAdapter({
          clientId: process.env.SLACK_APP_CLIENT_ID,
          clientSecret: process.env.SLACK_APP_CLIENT_SECRET,
          signingSecret: process.env.SLACK_APP_SIGNING_SECRET,
          botToken: process.env.SLACK_APP_BOT_TOKEN,
        }),
        toolDisplay: 'hidden',
      },
    },
    handlers: createHandlers(deps),
  });

  // Gate dispatch on the sender having linked their Slack account to a Mastra
  // tenant, so the run resolves that user's model credentials. Unset store →
  // no gating (pre-account-linking behavior). This is the backstop behind the
  // handler-level Connect card — it enforces the gate on every dispatch path.
  if (accountLinks) {
    channels.setAccountLinkResolver(createAccountLinkResolver(accountLinks));
  }

  return channels;
}
