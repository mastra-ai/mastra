import { Spacer } from '@mariozechner/pi-tui';

import { loadSettings, OBSERVABILITY_AUTH_PREFIX, saveSettings } from '../../onboarding/settings.js';
import { AskQuestionInlineComponent } from '../components/ask-question-inline.js';
import { theme } from '../theme.js';
import type { SlashCommandContext } from './types.js';

const VALID_PROJECT_ID = /^[a-zA-Z0-9_-]+$/;

function showStatus(ctx: SlashCommandContext): void {
  const resourceId = ctx.harness.getResourceId();
  const settings = loadSettings();
  const resourceConfig = settings.observability.resources[resourceId];
  const hasToken = ctx.authStorage?.hasStoredApiKey(`${OBSERVABILITY_AUTH_PREFIX}${resourceId}`) ?? false;

  const lines: string[] = [theme.bold(theme.fg('accent', 'Cloud Observability')), ''];

  if (resourceConfig && hasToken) {
    lines.push(`${theme.fg('success', '●')} Connected`);
    lines.push(`  Project:    ${resourceConfig.projectId}`);
    lines.push(`  Resource:   ${resourceId}`);
    lines.push(`  Since:      ${new Date(resourceConfig.configuredAt).toLocaleDateString()}`);
  } else if (resourceConfig && !hasToken) {
    lines.push(`${theme.fg('warning', '●')} Partially configured (missing token)`);
    lines.push(`  Project:    ${resourceConfig.projectId}`);
    lines.push(`  Resource:   ${resourceId}`);
    lines.push('');
    lines.push(theme.fg('dim', 'Run /observability connect to re-enter credentials.'));
  } else {
    const envToken = process.env.MASTRA_CLOUD_ACCESS_TOKEN;
    const envProject = process.env.MASTRA_PROJECT_ID;
    if (envToken) {
      lines.push(`${theme.fg('success', '●')} Connected ${theme.fg('dim', '(via environment variables)')}`);
      if (envProject) {
        lines.push(`  Project:    ${envProject}`);
      }
      lines.push(`  Resource:   ${resourceId}`);
    } else {
      lines.push(`${theme.fg('dim', '●')} Not configured`);
      lines.push(`  Resource:   ${resourceId}`);
    }
  }

  lines.push('');
  lines.push(theme.fg('dim', 'Commands:'));
  lines.push(theme.fg('dim', '  /observability connect      — configure cloud project'));
  lines.push(theme.fg('dim', '  /observability disconnect   — remove configuration'));

  ctx.showInfo(lines.join('\n'));
}

function showInlineQuestion(ctx: SlashCommandContext, component: AskQuestionInlineComponent): void {
  ctx.state.activeInlineQuestion = component;
  ctx.state.chatContainer.addChild(new Spacer(1));
  ctx.state.chatContainer.addChild(component);
  ctx.state.chatContainer.addChild(new Spacer(1));
  ctx.state.ui.requestRender();
  ctx.state.chatContainer.invalidate();
}

function handleConnect(ctx: SlashCommandContext): Promise<void> {
  if (!ctx.authStorage) {
    ctx.showError('Auth storage not available. Cannot store credentials.');
    return Promise.resolve();
  }

  const resourceId = ctx.harness.getResourceId();

  return new Promise<void>(resolve => {
    const projectIdQuestion = new AskQuestionInlineComponent(
      {
        question: 'Enter your cloud project ID:',
        formatResult: (answer: string) => `Project ID: ${answer}`,
        onSubmit: (projectId: string) => {
          ctx.state.activeInlineQuestion = undefined;

          if (!VALID_PROJECT_ID.test(projectId)) {
            ctx.showError('Invalid project ID. Only letters, numbers, hyphens, and underscores are allowed.');
            resolve();
            return;
          }

          const tokenQuestion = new AskQuestionInlineComponent(
            {
              question: 'Enter your cloud access token:',
              formatResult: () => 'Token: ••••••••',
              onSubmit: (token: string) => {
                ctx.state.activeInlineQuestion = undefined;

                const settings = loadSettings();
                settings.observability.resources[resourceId] = {
                  projectId,
                  configuredAt: new Date().toISOString(),
                };
                saveSettings(settings);

                ctx.authStorage!.setStoredApiKey(`${OBSERVABILITY_AUTH_PREFIX}${resourceId}`, token);

                ctx.showInfo(
                  `${theme.fg('success', '✓')} Cloud observability configured.\n` +
                    `  Project:  ${projectId}\n` +
                    `  Resource: ${resourceId}\n\n` +
                    theme.fg('dim', 'Restart MastraCode for the new configuration to take effect.'),
                );
                resolve();
              },
              onCancel: () => {
                ctx.state.activeInlineQuestion = undefined;
                resolve();
              },
            },
            ctx.state.ui,
          );

          showInlineQuestion(ctx, tokenQuestion);
        },
        onCancel: () => {
          ctx.state.activeInlineQuestion = undefined;
          resolve();
        },
      },
      ctx.state.ui,
    );

    showInlineQuestion(ctx, projectIdQuestion);
  });
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
    case 'status':
    case undefined:
      showStatus(ctx);
      break;
    default:
      ctx.showInfo(
        'Usage:\n' +
          '  /observability              — show current status\n' +
          '  /observability connect      — configure cloud observability\n' +
          '  /observability disconnect   — remove cloud observability config',
      );
  }
}
