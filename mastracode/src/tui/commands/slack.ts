/**
 * `/slack` command — manage the opt-in Slack MCP integration.
 *
 * Surface:
 *   /slack                     status (connected team, level, tools)
 *   /slack connect [level]     run PKCE login, store token, enable + reload MCP
 *   /slack connect --byo <id>  same, using a BYO public client_id
 *   /slack level <level>       change the requested permission level
 *   /slack disconnect          clear the token, disable + remove the MCP entry
 *
 * The feature is off by default. There is no separate enable toggle: `connect`
 * turns it on (`slack.enabled = true`) and `disconnect` turns it off. The
 * `slack.enabled` flag is internal derived state the MCP resolver reads; it is
 * never surfaced in /settings.
 */

import { loadSettings, saveSettings } from '../../onboarding/settings.js';
import { resolveSlackClientId } from '../../slack/client-id.js';
import { hasSlackToken, SLACK_MCP_SERVER_NAME } from '../../slack/config.js';
import { SLACK_AUTH_PROVIDER_ID, setSlackLoginContext } from '../../slack/oauth.js';
import {
  DEFAULT_SLACK_PERMISSION_LEVEL,
  isSlackPermissionLevel,
  scopesForLevel,
  SLACK_PERMISSION_LEVELS,
} from '../../slack/scopes.js';
import type { SlackPermissionLevel } from '../../slack/scopes.js';
import { LoginDialogComponent } from '../components/login-dialog.js';
import { showModalOverlay } from '../overlay.js';
import type { SlashCommandContext } from './types.js';

function permissionLevelList(): string {
  return SLACK_PERMISSION_LEVELS.join(', ');
}

/** Extract a `--byo <client_id>` pair from args, returning the id and the rest. */
function extractByoClientId(args: string[]): { clientId?: string; rest: string[] } {
  const index = args.indexOf('--byo');
  if (index === -1) return { rest: args };
  const clientId = args[index + 1];
  const rest = [...args.slice(0, index), ...args.slice(index + 2)];
  return { clientId, rest };
}

function describeSlackStatus(ctx: SlashCommandContext, level: SlackPermissionLevel, enabled: boolean): string {
  const authStorage = ctx.authStorage;
  const connected = authStorage ? hasSlackToken(authStorage) : false;
  const cred = authStorage?.get(SLACK_AUTH_PROVIDER_ID);
  const lines: string[] = [`Slack integration: ${enabled ? 'enabled' : 'disabled'}`];

  if (connected && cred?.type === 'oauth') {
    const team = typeof cred.teamName === 'string' ? cred.teamName : undefined;
    const teamId = typeof cred.teamId === 'string' ? cred.teamId : undefined;
    lines.push(`Connected: ${team ?? teamId ?? 'yes'}`);
    if (typeof cred.expires === 'number') {
      const expired = Date.now() >= cred.expires;
      lines.push(`Token: ${expired ? 'expired (auto-refreshes on next use)' : 'valid'}`);
    }
  } else {
    lines.push('Connected: no — run /slack connect');
  }

  lines.push(`Permission level: ${level} (${scopesForLevel(level).length} scopes)`);

  const slackStatus = ctx.mcpManager?.getServerStatuses().find(s => s.name === SLACK_MCP_SERVER_NAME);
  if (slackStatus) {
    lines.push(
      `MCP server: ${slackStatus.connected ? 'connected' : 'not connected'}, ${slackStatus.toolCount} tool${slackStatus.toolCount === 1 ? '' : 's'}`,
    );
  }

  return lines.join('\n');
}

async function connectSlack(
  ctx: SlashCommandContext,
  level: SlackPermissionLevel,
  clientId: string | undefined,
): Promise<void> {
  if (!ctx.authStorage) {
    ctx.showError('Auth storage not configured');
    return;
  }

  if (!resolveSlackClientId(clientId)) {
    ctx.showError(
      'No Slack client_id available. Mastra\u2019s Slack app is not published yet; connect with `/slack connect --byo <client_id>`.',
    );
    return;
  }

  setSlackLoginContext({ permissionLevel: level, clientId });

  await new Promise<void>(resolve => {
    const dialog = new LoginDialogComponent(ctx.state.ui, SLACK_AUTH_PROVIDER_ID, () => {
      ctx.state.ui.hideOverlay();
      resolve();
    });

    showModalOverlay(ctx.state.ui, dialog, { widthPercent: 0.8, maxHeight: '60%' });
    dialog.focused = true;

    ctx
      .authStorage!.login(SLACK_AUTH_PROVIDER_ID, {
        onAuth: (info: { url: string; instructions?: string }) => {
          dialog.showAuth(info.url, info.instructions);
        },
        onPrompt: async (prompt: { message: string; placeholder?: string }) => {
          return dialog.showPrompt(prompt.message, prompt.placeholder);
        },
        onProgress: (message: string) => {
          dialog.showProgress(message);
        },
        signal: dialog.signal,
      })
      .then(async () => {
        ctx.state.ui.hideOverlay();
        // Connecting turns the integration on. `enabled` is internal derived
        // state the MCP resolver reads; persist the chosen level + BYO id too.
        const current = loadSettings();
        current.slack.enabled = true;
        current.slack.permissionLevel = level;
        if (clientId) current.slack.clientId = clientId;
        saveSettings(current);
        await ctx.mcpManager?.reload();
        const status = ctx.mcpManager?.getServerStatuses().find(s => s.name === SLACK_MCP_SERVER_NAME);
        if (status?.connected) {
          ctx.showInfo(`Connected to Slack — ${status.toolCount} tool${status.toolCount === 1 ? '' : 's'} available.`);
        } else {
          ctx.showInfo('Connected to Slack. Run /mcp to see available tools.');
        }
        resolve();
      })
      .catch((error: Error) => {
        ctx.state.ui.hideOverlay();
        if (error.message !== 'Login cancelled') {
          ctx.showError(`Failed to connect Slack: ${error.message}`);
        }
        resolve();
      });
  });
}

async function disconnectSlack(ctx: SlashCommandContext): Promise<void> {
  if (!ctx.authStorage) {
    ctx.showError('Auth storage not configured');
    return;
  }
  const settings = loadSettings();
  if (!hasSlackToken(ctx.authStorage) && !settings.slack.enabled) {
    ctx.showInfo('Slack is not connected.');
    return;
  }
  ctx.authStorage.logout(SLACK_AUTH_PROVIDER_ID);
  // Disconnecting turns the integration off so the MCP resolver drops the entry.
  settings.slack.enabled = false;
  saveSettings(settings);
  await ctx.mcpManager?.reload();
  ctx.showInfo('Disconnected from Slack.');
}

export async function handleSlackCommand(ctx: SlashCommandContext, args: string[] = []): Promise<void> {
  const settings = loadSettings();
  const level = settings.slack.permissionLevel;

  const [action, ...rest] = args;

  if (!action || action === 'status') {
    ctx.showInfo(describeSlackStatus(ctx, level, settings.slack.enabled));
    return;
  }

  if (action === 'connect') {
    const { clientId, rest: connectArgs } = extractByoClientId(rest);
    const requestedLevel = connectArgs[0];
    if (requestedLevel && !isSlackPermissionLevel(requestedLevel)) {
      ctx.showError(`Unknown permission level '${requestedLevel}'. Choose one of: ${permissionLevelList()}.`);
      return;
    }
    const connectLevel: SlackPermissionLevel = isSlackPermissionLevel(requestedLevel)
      ? requestedLevel
      : (level ?? DEFAULT_SLACK_PERMISSION_LEVEL);
    await connectSlack(ctx, connectLevel, clientId ?? settings.slack.clientId);
    return;
  }

  if (action === 'level' || action === 'scopes') {
    const requested = rest[0];
    if (!requested) {
      ctx.showInfo(`Current permission level: ${level}. Choose one of: ${permissionLevelList()}.`);
      return;
    }
    if (!isSlackPermissionLevel(requested)) {
      ctx.showError(`Unknown permission level '${requested}'. Choose one of: ${permissionLevelList()}.`);
      return;
    }
    const current = loadSettings();
    current.slack.permissionLevel = requested;
    saveSettings(current);
    ctx.showInfo(`Slack permission level set to ${requested}. Run /slack connect to re-authorize with the new scopes.`);
    return;
  }

  if (action === 'disconnect') {
    await disconnectSlack(ctx);
    return;
  }

  ctx.showError('Usage: /slack, /slack connect [level] [--byo <client_id>], /slack level <level>, /slack disconnect');
}
