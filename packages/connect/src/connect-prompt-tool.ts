import { getChannelRun, toolResumeButton } from '@mastra/core/channels';
import type { ChannelRun, ChannelSuspendPayload } from '@mastra/core/channels';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { ConnectSession, ConnectUrl, IntegrationCatalogEntry, ProjectConnection } from './client.js';

/**
 * Record key of the built-in connect-prompt tool. Reserved: a provider tool
 * resolving to the same key is a hard error, same as any duplicate.
 */
export const CONNECT_PROMPT_TOOL_KEY = 'request_connection';

/** One connectable provider in a connect-prompt payload. */
export interface ConnectPromptProvider {
  id: string;
  displayName: string | null;
  logoUrl: string | null;
  authType: string | null;
  /** Fields the UI must collect before starting headless authorization. */
  authFields: NonNullable<IntegrationCatalogEntry['authFields']> | null;
  /** Whether a usable (active) connection already serves this provider for the caller. */
  connected: boolean;
  /** Which connection serves it when connected: the caller's own wins over a global one. */
  scope: 'global' | 'user' | null;
}

/**
 * Structured output of the connect-prompt tool. Chat UIs detect
 * `type: 'connect-prompt'` and render the providers as a connect card; the
 * card drives the mounted `userConnectRoutes()` flow (session → launch gate →
 * status polling). In Slack, Telegram and Teams threads the tool starts the
 * session itself when the owner clicks Connect and sends the link only to
 * them; the link never goes into this payload, a card, or the tool's result.
 */
export interface ConnectPromptPayload {
  type: 'connect-prompt';
  /** Echoed when the agent asked for one specific provider and it is connectable. */
  requestedProvider?: string;
  providers: ConnectPromptProvider[];
  /** Outcome for the model once a paused prompt resumes, e.g. "Linear connected successfully." */
  message?: string;
  /** Why the connection failed, as the chat UI reported it, when a paused prompt resumes without one. */
  error?: string;
}

/**
 * What a paused `request_connection` call is resumed with.
 *
 * A chat UI resumes it once the user's connection settles: `active`, or
 * `failed` with the reason the UI saw (closed window, rejected credentials,
 * connection limit). In Slack, Telegram and Teams threads, the card's buttons
 * resume it with an `action`: `connect` sends the clicker a private sign-in
 * link, `check` looks for the connection, and `cancel` gives up.
 *
 * The tool re-checks the platform rather than trusting either, so a stale or
 * forged resume can't report a false success, and a failure that raced a
 * success reports success.
 */
export const connectPromptResumeSchema = z.union([
  z.object({ provider: z.string().min(1), status: z.literal('active') }),
  z.object({ provider: z.string().min(1), status: z.literal('failed'), error: z.string().trim().min(1).max(500) }),
  z.object({ action: z.enum(['connect', 'check', 'cancel']) }),
]);

export type ConnectPromptResume = z.infer<typeof connectPromptResumeSchema>;

export interface ConnectPromptInputs {
  catalog: IntegrationCatalogEntry[];
  connections: ProjectConnection[];
  /** Effective code or project allowlist; undefined means the full catalog. */
  allowlist: Set<string> | undefined;
}

/** What a paused call carries in a channel thread: its card and the sign-in it started. */
interface ChannelConnectPromptPayload extends ConnectPromptPayload, ChannelSuspendPayload {
  /** Connection the clicker's sign-in link creates. Not a capability: reading its link needs the owner's assertion. */
  connectionId?: string;
  /** When that sign-in link stops working. */
  expiresAt?: string;
}

/** Error the call fails with when the user presses Cancel, matching Studio's card. */
const CONNECT_CANCELLED_ERROR = 'The user cancelled connecting.';

const NOT_OWNER_NOTICE = 'Only the person this conversation belongs to can connect an account here.';
const UNCONFIRMED_NOTICE = "I couldn't confirm this conversation is yours, so I can't send you a sign-in link here.";
const EXPIRED_ERROR = 'The sign-in link expired.';
const FAILED_ERROR = 'The sign-in did not finish.';

function connectCard(
  toolCallId: string,
  text: string,
  primary: { action: 'connect' | 'check'; label: string },
): NonNullable<ChannelSuspendPayload['channelCard']> {
  return {
    type: 'card',
    children: [
      { type: 'text', content: text },
      {
        type: 'actions',
        children: [
          toolResumeButton({ toolCallId, ...primary, style: 'primary' }),
          toolResumeButton({ toolCallId, action: 'cancel', label: 'Cancel' }),
        ],
      },
    ],
  };
}

function connectPromptCard(toolCallId: string, name: string) {
  return connectCard(toolCallId, `Connect **${name}** to continue.`, { action: 'connect', label: `Connect ${name}` });
}

/** Whether a card the call showed offers this action's button. */
function offers(card: NonNullable<ChannelSuspendPayload['channelCard']>, toolCallId: string, action: string): boolean {
  const { id } = toolResumeButton({ toolCallId, action, label: action });
  return card.children.some(
    child => child.type === 'actions' && child.children.some(button => 'id' in button && button.id === id),
  );
}

/**
 * Sends the sign-in link to the clicker only: an ephemeral message where the
 * platform has one (Slack), or a DM. False when it couldn't be delivered
 * privately; the link is never posted anywhere else.
 */
async function sendPrivately(run: ChannelRun, name: string, link: ConnectUrl): Promise<boolean> {
  try {
    const sent = await run.thread.postEphemeral(
      run.actor!.userId,
      `Connect ${name}: ${link.connectUrl}\nThis link is only for you.`,
      { fallbackToDM: true },
    );
    return sent !== null;
  } catch {
    return false;
  }
}

/**
 * Builds the built-in tool that lets an agent prompt the end user to connect
 * a provider account mid-conversation. Only added to resource-scoped
 * resolutions: without an end-user identity there is nobody to scope a new
 * connection to.
 *
 * The connectable set respects the effective project policy: an explicit
 * `tools({ providers })` allowlist wins, otherwise the project's provider
 * configuration is loaded from Mastra Platform.
 *
 * `loadInputs` is called per tool invocation so provider policy and connection state are fresh —
 * after the user connects through the rendered card, the agent can call the
 * tool again and see `connected: true` without waiting out the snapshot TTL.
 */
export function buildConnectPromptTool({
  loadInputs,
  resourceId,
  createSession,
  getConnectUrl,
  invalidate,
}: {
  loadInputs: () => Promise<ConnectPromptInputs>;
  resourceId: string;
  /** Starts a sign-in for this resource. Used by the channel card's Connect button. */
  createSession: (provider: string) => Promise<ConnectSession>;
  /** Reads a pending sign-in's vendor link under this resource's assertion. */
  getConnectUrl: (connectionId: string) => Promise<ConnectUrl>;
  /** Tells tool resolutions a connection settled, as the status route does. */
  invalidate: (connection: ProjectConnection) => void;
}) {
  return createTool({
    id: CONNECT_PROMPT_TOOL_KEY,
    description:
      'Ask the current user to connect a provider account (e.g. Linear, Slack). ' +
      'Call this when a task needs a provider whose tools are unavailable because no account is connected, ' +
      'or when the user asks to connect one. Do not fabricate links. Pass `provider` to request one ' +
      'specific provider: the call renders a connect prompt in the UI and waits until the user connects, ' +
      'and its result then says whether the connection succeeded or why it failed. Omit `provider` to list everything the ' +
      'user can connect without waiting; an unknown provider also returns that list.',
    inputSchema: z.object({
      provider: z
        .string()
        .optional()
        .describe('Provider id to request (e.g. "linear"). Omit to list all connectable providers.'),
    }),
    resumeSchema: connectPromptResumeSchema,
    execute: async (input, context): Promise<ConnectPromptPayload> => {
      const { catalog, connections, allowlist } = await loadInputs();

      // Provider ids are compared case-insensitively because catalog ids are
      // platform-defined while code configuration may use different casing.
      const allow = allowlist === undefined ? undefined : new Set(Array.from(allowlist, id => id.toLowerCase()));
      const connectable = catalog.filter(entry => allow === undefined || allow.has(entry.id.toLowerCase()));
      const toProvider = (entry: IntegrationCatalogEntry): ConnectPromptProvider => {
        const usable = connections.filter(
          connection =>
            connection.integrationId.toLowerCase() === entry.id.toLowerCase() && connection.status === 'active',
        );
        const own = usable.some(connection => connection.resourceId === resourceId);
        return {
          id: entry.id,
          displayName: entry.displayName ?? null,
          logoUrl: entry.logoUrl ?? null,
          authType: entry.authType ?? null,
          authFields: entry.authFields ?? null,
          connected: usable.length > 0,
          scope: own ? 'user' : usable.length > 0 ? 'global' : null,
        };
      };

      const requestedId = input.provider?.toLowerCase();
      const requested =
        requestedId === undefined ? undefined : connectable.find(entry => entry.id.toLowerCase() === requestedId);
      // Unknown or omitted provider: list the full connectable set so the
      // agent can correct itself instead of failing.
      const payload: ConnectPromptPayload = requested
        ? { type: 'connect-prompt', requestedProvider: requested.id, providers: [toProvider(requested)] }
        : { type: 'connect-prompt', providers: connectable.map(toProvider) };

      const agent = context?.agent;
      const resumed = agent?.resumeData as ConnectPromptResume | undefined;
      if (resumed && 'action' in resumed) {
        const name = requested
          ? (payload.providers[0]?.displayName ?? requested.id)
          : (input.provider ?? 'The provider');
        const failed = (error: string): ConnectPromptPayload => ({
          ...payload,
          message: `${name} could not be connected: ${error}`,
          error,
        });
        const previous = agent?.suspendPayload as ChannelConnectPromptPayload | undefined;
        const toolCallId = agent!.toolCallId;
        const pause = async (next: Omit<ChannelConnectPromptPayload, keyof ConnectPromptPayload>) => {
          await agent!.suspend({ ...payload, ...next } satisfies ChannelConnectPromptPayload);
          return payload;
        };
        const run = getChannelRun(context?.requestContext);
        // After a restart core can't tell a late button from a current one,
        // so a button the card no longer offers leaves the call as it is.
        if (previous?.channelCard && !offers(previous.channelCard, toolCallId, resumed.action)) {
          return pause({
            connectionId: previous.connectionId,
            expiresAt: previous.expiresAt,
            channelCard: previous.channelCard,
          });
        }
        const refuse = async () => {
          if (!run?.actor) return;
          await run.thread.postEphemeral(run.actor.userId, NOT_OWNER_NOTICE, { fallbackToDM: false }).catch(() => null);
        };

        // This toolset reads the platform for its own resource only. Resolved
        // for someone other than the conversation's owner (a per-request scope
        // that follows the clicker), it can't tell how the owner's sign-in is
        // going, so only Cancel may end the call.
        const owner = agent?.resourceId ?? resourceId;
        if (resourceId !== owner) {
          if (resumed.action === 'cancel') return failed(CONNECT_CANCELLED_ERROR);
          if (run?.actorResourceId === owner) {
            context?.mastra
              ?.getLogger?.()
              ?.warn(
                "request_connection's tools serve another resource than this conversation, so its owner can't connect here",
                { toolsResourceId: resourceId, conversationResourceId: owner },
              );
          }
          await refuse();
          return pause({
            connectionId: previous?.connectionId,
            expiresAt: previous?.expiresAt,
            channelCard: previous?.channelCard ?? connectPromptCard(toolCallId, name),
          });
        }

        if (!requested) return failed('It is no longer available to connect.');
        if (payload.providers[0]?.connected) {
          const settled = connections.find(
            connection =>
              connection.integrationId.toLowerCase() === requested.id.toLowerCase() && connection.status === 'active',
          );
          if (settled) invalidate(settled);
          return { ...payload, message: `${name} connected successfully.` };
        }
        if (resumed.action === 'cancel') return failed(CONNECT_CANCELLED_ERROR);

        const waiting = (
          text: string,
          signIn: Pick<ChannelConnectPromptPayload, 'connectionId' | 'expiresAt'> | undefined,
        ) =>
          pause({
            connectionId: signIn?.connectionId,
            expiresAt: signIn?.expiresAt,
            channelCard: connectCard(toolCallId, text, { action: 'check', label: "I've connected" }),
          });

        if (resumed.action === 'check') {
          if (previous?.connectionId !== undefined) {
            const signIn = connections.find(connection => connection.id === previous.connectionId);
            if (signIn && signIn.status !== 'pending') return failed(FAILED_ERROR);
            const expired = previous.expiresAt !== undefined && Date.parse(previous.expiresAt) <= Date.now();
            // The platform drops a sign-in that was never finished.
            if (!signIn || expired) return failed(EXPIRED_ERROR);
          }
          return waiting(`${name} isn't connected yet. Finish signing in, then press I've connected.`, previous);
        }

        // Connect: only the person the conversation belongs to may start a
        // sign-in, since the account they connect serves this resource.
        if (run?.actor && run.actorResourceId === undefined) {
          // Core couldn't resolve this user's resource (a resolveResourceId
          // hook that failed, or a reply in text mode), so ownership can't be
          // checked here; the app can.
          await run.thread
            .postEphemeral(run.actor.userId, `${UNCONFIRMED_NOTICE} Connect ${name} from the app.`, {
              fallbackToDM: false,
            })
            .catch(() => null);
          return waiting(`Connect ${name} from the app, then press I've connected.`, undefined);
        }
        if (!run?.actor || run.actorResourceId !== owner) {
          await refuse();
          return pause({ channelCard: connectPromptCard(toolCallId, name) });
        }
        // Only a sign-in the user got a link for decides what I've connected
        // reports; otherwise they connect from the app, which starts its own.
        let signIn: Pick<ChannelConnectPromptPayload, 'connectionId' | 'expiresAt'> | undefined;
        try {
          const session = await createSession(requested.id);
          const link = await getConnectUrl(session.connectionId);
          if (await sendPrivately(run, name, link)) {
            signIn = { connectionId: session.connectionId, expiresAt: link.expiresAt };
          }
        } catch (error) {
          // The platform couldn't start a sign-in here; the app still can.
          // Its errors carry the status and the platform's reason; the link is
          // in no request or response on these paths.
          context?.mastra?.getLogger?.()?.warn('request_connection could not start a sign-in', {
            provider: requested.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        return waiting(
          signIn
            ? `I sent you a private link to connect ${name}. When you're done, press I've connected.`
            : `I couldn't send you a private link. Connect ${name} from the app, then press I've connected.`,
          signIn,
        );
      }
      if (resumed) {
        const provider = payload.providers.find(entry => entry.id.toLowerCase() === resumed.provider.toLowerCase());
        const name = provider?.displayName ?? resumed.provider;
        if (provider?.connected) return { ...payload, message: `${name} connected successfully.` };
        if (resumed.status === 'failed') {
          return { ...payload, message: `${name} could not be connected: ${resumed.error}`, error: resumed.error };
        }
        return { ...payload, message: `${name} is not connected yet.` };
      }

      // Only a specific, not-yet-connected provider is worth waiting for. An
      // omitted or unknown provider returns the list right away so the agent
      // can correct itself, and a connected one already works.
      if (!requested || payload.providers[0]?.connected) return payload;

      // Pause the run until the user connects; the chat UI resumes it with the
      // settled provider so the agent continues without a user message.
      // Outside an agent run there is nothing to resume, so return the prompt.
      // In a Slack, Telegram or Teams thread the card's buttons resume it.
      if (!agent?.suspend) return payload;
      if (!getChannelRun(context?.requestContext)) {
        await agent.suspend(payload);
        return payload;
      }
      const name = payload.providers[0]!.displayName ?? requested.id;
      const fromApp = (reason: string) => {
        context?.mastra?.getLogger?.()?.warn(`request_connection shows no card in this thread: ${reason}`, {
          provider: requested.id,
        });
        return { ...payload, message: `${name} can't be connected from this conversation. Connect it from the app.` };
      };
      // A toolset serving someone other than the conversation's owner could
      // never start the owner's sign-in, so a Connect button would do nothing.
      if (resourceId !== (agent.resourceId ?? resourceId)) {
        return fromApp("the tools serve another resource than this conversation's");
      }
      let channelCard: ChannelConnectPromptPayload['channelCard'];
      try {
        channelCard = connectPromptCard(agent.toolCallId, name);
      } catch (error) {
        // The tool call id is too long for a button id.
        return fromApp(error instanceof Error ? error.message : String(error));
      }
      await agent.suspend({ ...payload, channelCard } satisfies ChannelConnectPromptPayload);
      return payload;
    },
  });
}
