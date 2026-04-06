import { Spacer } from '@mariozechner/pi-tui';

import type { MastraBrowser } from '@mastra/core/browser';

import type { BrowserProvider, BrowserSettings, StagehandEnv } from '../../onboarding/settings.js';
import { createBrowserFromSettings, loadSettings, saveSettings } from '../../onboarding/settings.js';
import { AskQuestionInlineComponent } from '../components/ask-question-inline.js';
import type { SlashCommandContext } from './types.js';

/**
 * Key used to store the active browser settings in harness state.
 * This tracks what browser config is actually running in this instance,
 * which may differ from the settings file if another instance changed it.
 */
const ACTIVE_BROWSER_KEY = 'activeBrowserSettings';

/**
 * /browser command - Configure browser automation for agents.
 *
 * Usage:
 *   /browser          - Interactive setup wizard
 *   /browser status   - Show current browser configuration
 *   /browser on       - Enable browser with current settings
 *   /browser off      - Disable browser
 */

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
 * Apply browser settings to all mode agents and track the active settings.
 */
function applyBrowserToAgents(
  ctx: SlashCommandContext,
  browser: MastraBrowser | undefined,
  browserSettings?: BrowserSettings,
): void {
  const modes = ctx.harness.listModes();
  for (const mode of modes) {
    const agent = typeof mode.agent === 'function' ? mode.agent(ctx.state.harness.getState()) : mode.agent;
    agent.setBrowser(browser);
  }
  // Track the active browser settings in harness state
  ctx.harness.setState({ [ACTIVE_BROWSER_KEY]: browserSettings } as any);
}

/**
 * Get a summary key for browser settings to detect config drift.
 */
function getBrowserConfigKey(settings: BrowserSettings): string {
  if (!settings.enabled) return 'disabled';
  const parts: string[] = [settings.provider];
  if (settings.provider === 'stagehand' && settings.stagehand?.env) {
    parts.push(settings.stagehand.env);
  }
  parts.push(settings.headless ? 'headless' : 'headed');
  return parts.join(':');
}

/**
 * /browser — Configure browser automation settings.
 *
 * Interactive flow to set up browser provider (Stagehand or AgentBrowser),
 * headless mode, and provider-specific options.
 *
 * Changes are applied immediately to the current session.
 */
export async function handleBrowserCommand(ctx: SlashCommandContext, args: string[] = []): Promise<void> {
  const settings = loadSettings();
  const browser = settings.browser;

  // Handle quick commands
  const arg = args[0]?.toLowerCase();

  if (arg === 'status') {
    // Get the active browser settings from harness state (what's actually running)
    const state = ctx.harness.getState() as any;
    const activeSettings = state?.[ACTIVE_BROWSER_KEY] as BrowserSettings | undefined;

    // Check for config drift between file and active instance
    const hasDrift = activeSettings && getBrowserConfigKey(browser) !== getBrowserConfigKey(activeSettings);

    if (hasDrift && activeSettings) {
      // Show both active and file settings when they differ
      const lines: string[] = [];

      // Active session settings
      const activeProvider =
        activeSettings.provider === 'stagehand' ? 'Stagehand (AI-powered)' : 'AgentBrowser (deterministic)';
      const activeIsBrowserbase =
        activeSettings.provider === 'stagehand' && activeSettings.stagehand?.env === 'BROWSERBASE';
      lines.push('Browser (active):');
      lines.push(`  Provider: ${activeProvider}`);
      if (activeSettings.provider === 'stagehand' && activeSettings.stagehand) {
        lines.push(`  Environment: ${activeSettings.stagehand.env}`);
      }
      if (!activeIsBrowserbase) {
        lines.push(`  Headless: ${activeSettings.headless ? 'yes' : 'no'}`);
      }

      lines.push('');

      // Pending changes from file
      const fileProvider = browser.provider === 'stagehand' ? 'Stagehand (AI-powered)' : 'AgentBrowser (deterministic)';
      const fileIsBrowserbase = browser.provider === 'stagehand' && browser.stagehand?.env === 'BROWSERBASE';
      lines.push('Pending changes (not yet applied):');
      lines.push(`  Provider: ${fileProvider}`);
      if (browser.provider === 'stagehand' && browser.stagehand) {
        lines.push(`  Environment: ${browser.stagehand.env}`);
      }
      if (!fileIsBrowserbase) {
        lines.push(`  Headless: ${browser.headless ? 'yes' : 'no'}`);
      }

      lines.push('');
      lines.push('⚠️  /browser on to apply, /browser to reconfigure, or restart.');

      ctx.showInfo(lines.join('\n'));
    } else if (!browser.enabled) {
      ctx.showInfo('Browser: disabled');
    } else {
      // Normal status (no drift)
      const providerLabel =
        browser.provider === 'stagehand' ? 'Stagehand (AI-powered)' : 'AgentBrowser (deterministic)';
      const isBrowserbase = browser.provider === 'stagehand' && browser.stagehand?.env === 'BROWSERBASE';
      const lines = [`Browser: enabled`, `  Provider: ${providerLabel}`];
      if (browser.provider === 'stagehand' && browser.stagehand) {
        lines.push(`  Environment: ${browser.stagehand.env}`);
      }
      if (!isBrowserbase) {
        lines.push(`  Headless: ${browser.headless ? 'yes' : 'no'}`);
      }
      ctx.showInfo(lines.join('\n'));
    }
    return;
  }

  if (arg === 'off' || arg === 'disable') {
    const disabledSettings = { ...settings.browser, enabled: false };
    settings.browser = disabledSettings;
    saveSettings(settings);
    applyBrowserToAgents(ctx, undefined, disabledSettings);
    ctx.showInfo('Browser disabled.');
    return;
  }

  if (arg === 'on' || arg === 'enable') {
    const nextBrowser = { ...settings.browser, enabled: true };
    try {
      const browserInstance = await createBrowserFromSettings(nextBrowser);
      applyBrowserToAgents(ctx, browserInstance, nextBrowser);
      settings.browser = nextBrowser;
      saveSettings(settings);
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
      applyBrowserToAgents(ctx, undefined);
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

  // Build new browser settings
  const nextBrowser: BrowserSettings = {
    enabled: true,
    provider,
    headless,
    viewport: browser.viewport ?? { width: 1280, height: 720 },
    cdpUrl: browser.cdpUrl,
    stagehand: stagehandSettings,
  };

  // Apply browser to agents first, then persist on success
  try {
    const browserInstance = await createBrowserFromSettings(nextBrowser);
    applyBrowserToAgents(ctx, browserInstance, nextBrowser);
    settings.browser = nextBrowser;
    saveSettings(settings);
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
