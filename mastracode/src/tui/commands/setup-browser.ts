import { Spacer } from '@mariozechner/pi-tui';

import type { BrowserProvider, BrowserSettings, StagehandEnv } from '../../onboarding/settings.js';
import { loadSettings, saveSettings } from '../../onboarding/settings.js';
import { AskQuestionInlineComponent } from '../components/ask-question-inline.js';
import type { SlashCommandContext } from './types.js';

/**
 * Helper to show an inline question and return the answer.
 */
function askInline(
  ctx: SlashCommandContext,
  question: string,
  options: Array<{ label: string; description?: string }>,
): Promise<string | null> {
  return new Promise(resolve => {
    const questionComponent = new AskQuestionInlineComponent(
      {
        question,
        options,
        formatResult: answer => answer,
        onSubmit: answer => {
          ctx.state.activeInlineQuestion = undefined;
          resolve(answer);
        },
        onCancel: () => {
          ctx.state.activeInlineQuestion = undefined;
          resolve(null);
        },
      },
      ctx.state.ui,
    );

    ctx.state.activeInlineQuestion = questionComponent;
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.chatContainer.addChild(questionComponent);
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.ui.requestRender();
    ctx.state.chatContainer.invalidate();
  });
}

/**
 * /setup-browser — Configure browser automation settings.
 *
 * Interactive flow to set up browser provider (Stagehand or AgentBrowser),
 * headless mode, and provider-specific options.
 *
 * Changes require a restart to take effect.
 */
export async function handleSetupBrowserCommand(ctx: SlashCommandContext, args: string[] = []): Promise<void> {
  const settings = loadSettings();
  const browser = settings.browser;

  // Handle quick commands
  const arg = args[0]?.toLowerCase();

  if (arg === 'status') {
    if (!browser.enabled) {
      ctx.showInfo('Browser: disabled');
    } else {
      const providerLabel = browser.provider === 'stagehand' ? 'Stagehand (AI-powered)' : 'AgentBrowser (deterministic)';
      const lines = [
        `Browser: enabled`,
        `  Provider: ${providerLabel}`,
        `  Headless: ${browser.headless ? 'yes' : 'no'}`,
      ];
      if (browser.provider === 'stagehand' && browser.stagehand) {
        lines.push(`  Environment: ${browser.stagehand.env}`);
      }
      ctx.showInfo(lines.join('\n'));
    }
    return;
  }

  if (arg === 'off' || arg === 'disable') {
    settings.browser.enabled = false;
    saveSettings(settings);
    ctx.showInfo('Browser disabled. Restart to apply changes.');
    return;
  }

  if (arg === 'on' || arg === 'enable') {
    settings.browser.enabled = true;
    saveSettings(settings);
    const providerLabel = browser.provider === 'stagehand' ? 'Stagehand' : 'AgentBrowser';
    ctx.showInfo(`Browser enabled (${providerLabel}). Restart to apply changes.`);
    return;
  }

  // Step 1: Enable/disable browser (interactive)
  const enableChoice = await askInline(ctx, 'Enable browser automation?', [
    { label: 'Yes', description: 'Give the agent browser tools for web automation' },
    { label: 'No', description: 'Disable browser automation' },
  ]);

  if (!enableChoice || enableChoice === 'No') {
    if (browser.enabled) {
      settings.browser.enabled = false;
      saveSettings(settings);
      ctx.showInfo('Browser automation disabled. Restart to apply changes.');
    } else {
      ctx.showInfo('Browser automation remains disabled.');
    }
    return;
  }

  // Step 2: Select provider
  const providerChoice = await askInline(ctx, 'Select browser provider:', [
    { label: 'Stagehand', description: 'AI-powered (natural language instructions, recommended)' },
    { label: 'AgentBrowser', description: 'Deterministic (explicit selectors, requires Playwright)' },
  ]);

  if (!providerChoice) {
    ctx.showInfo('Browser setup cancelled.');
    return;
  }

  const provider: BrowserProvider = providerChoice === 'AgentBrowser' ? 'agent-browser' : 'stagehand';

  // Step 3: Headless mode
  const headlessChoice = await askInline(ctx, 'Run in headless mode?', [
    { label: 'No', description: 'Show browser window (easier to debug)' },
    { label: 'Yes', description: 'Hide browser window (faster, less resource usage)' },
  ]);

  if (!headlessChoice) {
    ctx.showInfo('Browser setup cancelled.');
    return;
  }

  const headless = headlessChoice === 'Yes';

  // Step 4: Stagehand-specific settings
  let stagehandSettings: BrowserSettings['stagehand'];
  if (provider === 'stagehand') {
    const envChoice = await askInline(ctx, 'Stagehand environment:', [
      { label: 'LOCAL', description: 'Run browser locally' },
      { label: 'BROWSERBASE', description: 'Use Browserbase cloud (requires API key)' },
    ]);

    if (!envChoice) {
      ctx.showInfo('Browser setup cancelled.');
      return;
    }

    const env = envChoice as StagehandEnv;

    if (env === 'BROWSERBASE') {
      ctx.showInfo(
        'For Browserbase, set BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID environment variables before restarting.',
      );
    }

    stagehandSettings = { env };
  }

  // Save settings
  settings.browser = {
    enabled: true,
    provider,
    headless,
    viewport: browser.viewport ?? { width: 1280, height: 720 },
    cdpUrl: browser.cdpUrl,
    stagehand: stagehandSettings,
  };
  saveSettings(settings);

  // Summary
  const summary = [
    'Browser automation enabled:',
    `  Provider: ${provider === 'stagehand' ? 'Stagehand (AI-powered)' : 'AgentBrowser (deterministic)'}`,
    `  Headless: ${headless ? 'yes' : 'no'}`,
  ];

  if (provider === 'stagehand' && stagehandSettings) {
    summary.push(`  Environment: ${stagehandSettings.env}`);
  }

  if (provider === 'agent-browser') {
    summary.push("  Note: Run 'pnpm exec playwright install chromium' if not already installed");
  }

  summary.push('');
  summary.push('Restart MastraCode to apply changes.');

  ctx.showInfo(summary.join('\n'));
}
