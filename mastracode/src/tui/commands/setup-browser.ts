import { Spacer } from '@mariozechner/pi-tui';

import type { MastraBrowser } from '@mastra/core/browser';

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
 * Create a browser instance from settings.
 */
async function createBrowserFromSettings(settings: BrowserSettings): Promise<MastraBrowser | undefined> {
  if (!settings.enabled) {
    return undefined;
  }

  const { provider, headless, viewport, cdpUrl, stagehand } = settings;

  if (provider === 'stagehand') {
    const { StagehandBrowser } = await import('@mastra/stagehand');
    return new StagehandBrowser({
      headless,
      viewport,
      cdpUrl,
      env: stagehand?.env ?? 'LOCAL',
      apiKey: stagehand?.apiKey ?? process.env.BROWSERBASE_API_KEY,
      projectId: stagehand?.projectId ?? process.env.BROWSERBASE_PROJECT_ID,
    });
  } else {
    const { AgentBrowser } = await import('@mastra/agent-browser');
    return new AgentBrowser({
      headless,
      viewport,
      cdpUrl,
    });
  }
}

/**
 * Apply browser settings to all mode agents.
 */
function applyBrowserToAgents(ctx: SlashCommandContext, browser: MastraBrowser | undefined): void {
  const modes = ctx.harness.listModes();
  for (const mode of modes) {
    const agent = typeof mode.agent === 'function' ? mode.agent(ctx.state.harness.getState()) : mode.agent;
    agent.setBrowser(browser);
  }
}

/**
 * /setup-browser — Configure browser automation settings.
 *
 * Interactive flow to set up browser provider (Stagehand or AgentBrowser),
 * headless mode, and provider-specific options.
 *
 * Changes are applied immediately to the current session.
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
      const providerLabel =
        browser.provider === 'stagehand' ? 'Stagehand (AI-powered)' : 'AgentBrowser (deterministic)';
      const isBrowserbase = browser.provider === 'stagehand' && browser.stagehand?.env === 'BROWSERBASE';
      const lines = [`Browser: enabled`, `  Provider: ${providerLabel}`];
      if (browser.provider === 'stagehand' && browser.stagehand) {
        lines.push(`  Environment: ${browser.stagehand.env}`);
      }
      // Only show headless for local browsers (not Browserbase)
      if (!isBrowserbase) {
        lines.push(`  Headless: ${browser.headless ? 'yes' : 'no'}`);
      }
      ctx.showInfo(lines.join('\n'));
    }
    return;
  }

  if (arg === 'off' || arg === 'disable') {
    settings.browser.enabled = false;
    saveSettings(settings);
    await applyBrowserToAgents(ctx, undefined);
    ctx.showInfo('Browser disabled.');
    return;
  }

  if (arg === 'on' || arg === 'enable') {
    settings.browser.enabled = true;
    saveSettings(settings);
    try {
      const browserInstance = await createBrowserFromSettings(settings.browser);
      await applyBrowserToAgents(ctx, browserInstance);
      const providerLabel = browser.provider === 'stagehand' ? 'Stagehand' : 'AgentBrowser';
      ctx.showInfo(`Browser enabled (${providerLabel}).`);
    } catch (err) {
      ctx.showError(`Failed to enable browser: ${err instanceof Error ? err.message : String(err)}`);
    }
    return;
  }

  // Step 1: Enable/disable browser (interactive)
  const enableChoice = await askInline(ctx, 'Enable browser automation?', [
    { label: 'Yes', description: 'Give the agent browser tools for web automation' },
    { label: 'No', description: 'Disable browser automation' },
  ]);

  // Cancel preserves current state
  if (!enableChoice) {
    ctx.showInfo('Browser setup cancelled.');
    return;
  }

  if (enableChoice === 'No') {
    if (browser.enabled) {
      settings.browser.enabled = false;
      saveSettings(settings);
      await applyBrowserToAgents(ctx, undefined);
      ctx.showInfo('Browser automation disabled.');
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

  // Step 3: Stagehand-specific settings (ask environment first)
  let stagehandSettings: BrowserSettings['stagehand'];
  let isBrowserbase = false;
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
    isBrowserbase = env === 'BROWSERBASE';

    if (isBrowserbase) {
      ctx.showInfo(
        'Browserbase requires BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID.\n' +
          'Set these in your shell profile (~/.zshrc) or pass them when starting MastraCode.',
      );
    }

    stagehandSettings = { env };
  }

  // Step 4: Headless mode (skip for Browserbase - runs in cloud)
  let headless = false;
  if (!isBrowserbase) {
    const headlessChoice = await askInline(ctx, 'Run in headless mode?', [
      { label: 'No', description: 'Show browser window (easier to debug)' },
      { label: 'Yes', description: 'Hide browser window (faster, less resource usage)' },
    ]);

    if (!headlessChoice) {
      ctx.showInfo('Browser setup cancelled.');
      return;
    }

    headless = headlessChoice === 'Yes';
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

  // Apply browser to agents
  try {
    const browserInstance = await createBrowserFromSettings(settings.browser);
    await applyBrowserToAgents(ctx, browserInstance);
  } catch (err) {
    ctx.showError(`Failed to create browser: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  // Summary
  const summary = [
    'Browser automation enabled:',
    `  Provider: ${provider === 'stagehand' ? 'Stagehand (AI-powered)' : 'AgentBrowser (deterministic)'}`,
  ];

  if (provider === 'stagehand' && stagehandSettings) {
    summary.push(`  Environment: ${stagehandSettings.env}`);
  }

  // Only show headless for local browsers
  if (!isBrowserbase) {
    summary.push(`  Headless: ${headless ? 'yes' : 'no'}`);
  }

  ctx.showInfo(summary.join('\n'));
}
