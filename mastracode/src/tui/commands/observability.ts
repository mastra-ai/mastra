import { loadSettings, OBSERVABILITY_AUTH_PREFIX, saveSettings } from '../../onboarding/settings.js';
import { askModalQuestion } from '../modal-question.js';
import { theme } from '../theme.js';
import type { SlashCommandContext } from './types.js';

const VALID_PROJECT_ID = /^[a-zA-Z0-9_-]+$/;

function showStatus(ctx: SlashCommandContext): void {
  const resourceId = ctx.harness.getResourceId();
  const settings = loadSettings();
  const resourceConfig = settings.observability.resources[resourceId];
  const hasToken = ctx.authStorage?.hasStoredApiKey(`${OBSERVABILITY_AUTH_PREFIX}${resourceId}`) ?? false;

  const lines: string[] = [theme.bold(theme.fg('accent', 'Observability')), ''];

  // Cloud status
  lines.push(theme.bold('Cloud'));
  if (resourceConfig && hasToken) {
    lines.push(`  ${theme.fg('success', '●')} Connected`);
    lines.push(`  Project:    ${resourceConfig.projectId}`);
    lines.push(`  Resource:   ${resourceId}`);
    lines.push(`  Since:      ${new Date(resourceConfig.configuredAt).toLocaleDateString()}`);
  } else if (resourceConfig && !hasToken) {
    lines.push(`  ${theme.fg('warning', '●')} Partially configured (missing token)`);
    lines.push(`  Project:    ${resourceConfig.projectId}`);
    lines.push('');
    lines.push(theme.fg('dim', '  Run /observability connect to re-enter credentials.'));
  } else {
    const envToken = process.env.MASTRA_CLOUD_ACCESS_TOKEN;
    const envProject = process.env.MASTRA_PROJECT_ID;
    if (envToken) {
      lines.push(`  ${theme.fg('success', '●')} Connected ${theme.fg('dim', '(via environment variables)')}`);
      if (envProject) {
        lines.push(`  Project:    ${envProject}`);
      }
      lines.push(`  Resource:   ${resourceId}`);
    } else {
      lines.push(`  ${theme.fg('dim', '●')} Not configured`);
      lines.push(`  Resource:   ${resourceId}`);
    }
  }

  // Local tracing status
  lines.push('');
  lines.push(theme.bold('Local tracing (DuckDB)'));
  if (settings.observability.localTracing) {
    lines.push(`  ${theme.fg('success', '●')} Enabled`);
  } else {
    lines.push(`  ${theme.fg('dim', '●')} Disabled`);
  }

  lines.push('');
  lines.push(theme.fg('dim', 'Commands:'));
  lines.push(theme.fg('dim', '  /observability connect      — configure cloud project'));
  lines.push(theme.fg('dim', '  /observability disconnect   — remove cloud configuration'));
  lines.push(theme.fg('dim', '  /observability local on     — enable local DuckDB tracing'));
  lines.push(theme.fg('dim', '  /observability local off    — disable local DuckDB tracing'));

  ctx.showInfo(lines.join('\n'));
}

async function handleConnect(ctx: SlashCommandContext): Promise<void> {
  if (!ctx.authStorage) {
    ctx.showError('Auth storage not available. Cannot store credentials.');
    return;
  }

  const resourceId = ctx.harness.getResourceId();
  const projectId = await askModalQuestion(ctx.state.ui, { question: 'Enter your cloud project ID:' });
  if (!projectId) return;

  if (!VALID_PROJECT_ID.test(projectId)) {
    ctx.showError('Invalid project ID. Only letters, numbers, hyphens, and underscores are allowed.');
    return;
  }

  const token = await askModalQuestion(ctx.state.ui, { question: 'Enter your cloud access token:' });
  if (!token) return;

  const settings = loadSettings();
  settings.observability.resources[resourceId] = {
    projectId,
    configuredAt: new Date().toISOString(),
  };
  saveSettings(settings);

  ctx.authStorage.setStoredApiKey(`${OBSERVABILITY_AUTH_PREFIX}${resourceId}`, token);

  ctx.showInfo(
    `${theme.fg('success', '✓')} Cloud observability configured.\n` +
      `  Project:  ${projectId}\n` +
      `  Resource: ${resourceId}\n\n` +
      theme.fg('dim', 'Restart MastraCode for the new configuration to take effect.'),
  );
}

function handleLocal(ctx: SlashCommandContext, args: string[]): void {
  const toggle = args[1]?.trim().toLowerCase();
  if (toggle !== 'on' && toggle !== 'off') {
    const settings = loadSettings();
    const current = settings.observability.localTracing ? 'on' : 'off';
    ctx.showInfo(
      `Local DuckDB tracing is currently ${theme.bold(current)}.\n\n` +
        theme.fg('dim', 'Usage:\n  /observability local on    — enable\n  /observability local off   — disable'),
    );
    return;
  }

  const enable = toggle === 'on';
  const settings = loadSettings();
  if (settings.observability.localTracing === enable) {
    ctx.showInfo(`Local tracing is already ${theme.bold(toggle)}.`);
    return;
  }

  settings.observability.localTracing = enable;
  saveSettings(settings);

  if (enable) {
    ctx.showInfo(
      `${theme.fg('success', '✓')} Local DuckDB tracing enabled.\n` +
        theme.fg('dim', 'Restart MastraCode for changes to take effect.'),
    );
  } else {
    ctx.showInfo(
      `${theme.fg('success', '✓')} Local DuckDB tracing disabled.\n` +
        theme.fg(
          'dim',
          'Restart MastraCode for changes to take effect.\nExisting data remains at the DuckDB path — delete manually if needed.',
        ),
    );
  }
}

function handleDisconnect(ctx: SlashCommandContext): void {
  const resourceId = ctx.harness.getResourceId();
  const settings = loadSettings();

  const hadConfig = resourceId in settings.observability.resources;
  const hadToken = ctx.authStorage?.hasStoredApiKey(`${OBSERVABILITY_AUTH_PREFIX}${resourceId}`) ?? false;

  if (!hadConfig && !hadToken) {
    ctx.showInfo(`No cloud observability configured for resource "${resourceId}".`);
    return;
  }

  delete settings.observability.resources[resourceId];
  saveSettings(settings);

  if (ctx.authStorage) {
    ctx.authStorage.remove(`apikey:${OBSERVABILITY_AUTH_PREFIX}${resourceId}`);
  }

  ctx.showInfo(
    `${theme.fg('success', '✓')} Cloud observability disconnected for resource "${resourceId}".\n` +
      theme.fg('dim', 'Restart MastraCode for changes to take effect.'),
  );
}

export async function handleObservabilityCommand(ctx: SlashCommandContext, args: string[]): Promise<void> {
  const sub = args[0]?.trim().toLowerCase();

  switch (sub) {
    case 'connect':
      await handleConnect(ctx);
      break;
    case 'disconnect':
      handleDisconnect(ctx);
      break;
    case 'local':
      handleLocal(ctx, args);
      break;
    case 'status':
    case undefined:
      showStatus(ctx);
      break;
    default:
      ctx.showInfo(
        'Usage:\n' +
          '  /observability              — show current status\n' +
          '  /observability connect      — configure cloud observability\n' +
          '  /observability disconnect   — remove cloud configuration\n' +
          '  /observability local on     — enable local DuckDB tracing\n' +
          '  /observability local off    — disable local DuckDB tracing',
      );
  }
}
