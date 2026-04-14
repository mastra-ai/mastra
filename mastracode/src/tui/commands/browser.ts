import { Spacer } from '@mariozechner/pi-tui';

import type { MastraBrowser } from '@mastra/core/browser';

import type { BrowserProvider, BrowserSettings, StagehandEnv } from '../../onboarding/settings.js';
import {
  checkProfileProviderMismatch,
  createBrowserFromSettings,
  loadSettings,
  saveSettings,
  setProfileProvider,
} from '../../onboarding/settings.js';
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
 *   /browser              - Interactive setup wizard
 *   /browser status       - Show current browser configuration
 *   /browser on           - Enable browser with current settings
 *   /browser off          - Disable browser
 *   /browser set <k> <v>  - Set a specific setting (profile, executablePath, storageState, cdpUrl)
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
 * Helper to show an inline text input and return the answer.
 */
function askText(ctx: SlashCommandContext, question: string, defaultValue?: string): Promise<string | null> {
  return new Promise(resolve => {
    const questionComponent = new AskQuestionInlineComponent(
      {
        question,
        allowEmptyInput: true,
        formatResult: answer => answer || '(empty)',
        onSubmit: answer => {
          ctx.state.activeInlineQuestion = undefined;
          const trimmed = answer.trim();
          resolve(trimmed.length > 0 ? trimmed : null);
        },
        onCancel: () => {
          ctx.state.activeInlineQuestion = undefined;
          resolve(null);
        },
      },
      ctx.state.ui,
    );

    // Set default value if provided
    if (defaultValue) {
      (questionComponent as any).input?.setValue?.(defaultValue);
    }

    ctx.state.activeInlineQuestion = questionComponent;
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.chatContainer.addChild(questionComponent);
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.ui.requestRender();
    ctx.state.chatContainer.invalidate();
  });
}

/**
 * Check for provider mismatch in profile and prompt for confirmation.
 * Returns true if we should proceed, false if user cancelled.
 */
async function checkAndConfirmProviderMismatch(
  ctx: SlashCommandContext,
  profile: string | undefined,
  targetProvider: BrowserProvider,
): Promise<boolean> {
  if (!profile) return true;

  const existingProvider = checkProfileProviderMismatch(profile, targetProvider);
  if (!existingProvider) return true;

  const targetLabel = targetProvider === 'stagehand' ? 'Stagehand' : 'AgentBrowser';
  const existingLabel = existingProvider === 'stagehand' ? 'Stagehand' : 'AgentBrowser';

  ctx.showInfo(
    `⚠️  Warning: This profile was last used by ${existingLabel}, but you're now using ${targetLabel}.\n` +
      'Using the same profile across different providers can cause compatibility issues.',
  );

  const proceed = await askInline(ctx, 'Continue anyway?', [
    { label: 'No', description: 'Cancel and use a different profile' },
    { label: 'Yes', description: 'Proceed (may cause issues)' },
  ]);

  return proceed === 'Yes';
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
  if (settings.profile) parts.push(`profile:${settings.profile}`);
  if (settings.executablePath) parts.push(`exec:${settings.executablePath}`);
  if (settings.cdpUrl) parts.push(`cdp:${settings.cdpUrl}`);
  if (settings.agentBrowser?.storageState) parts.push(`storage:${settings.agentBrowser.storageState}`);
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

  // /browser set <key> <value> - set a specific setting
  if (arg === 'set') {
    const key = args[1]?.toLowerCase();
    const value = args.slice(2).join(' '); // Allow spaces in paths

    if (!key) {
      ctx.showInfo(
        'Usage: /browser set <key> <value>\n\n' +
          'Keys:\n' +
          '  profile <path>       - Browser profile directory\n' +
          '  executablePath <path> - Browser executable path\n' +
          '  storageState <path>  - Playwright storage state file (agent-browser only)\n' +
          '  cdpUrl <url>         - CDP WebSocket URL\n\n' +
          'To remove a setting, use: /browser clear <key>\n\n' +
          'Examples:\n' +
          '  /browser set profile ~/.mastracode/browser-profile-stagehand\n' +
          '  /browser set executablePath /Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      );
      return;
    }

    const validKeys = ['profile', 'executablepath', 'storagestate', 'cdpurl'];
    if (!validKeys.includes(key)) {
      ctx.showError(`Unknown key: ${args[1]}. Valid keys: profile, executablePath, storageState, cdpUrl`);
      return;
    }

    if (!value) {
      ctx.showError(
        `Missing value. Use: /browser set ${args[1]} <value>\nTo remove a setting, use: /browser clear ${args[1]}`,
      );
      return;
    }

    const expandedValue = value.trim().replace(/^~/, process.env.HOME || '~');

    switch (key) {
      case 'profile':
        settings.browser.profile = expandedValue;
        // Auto-set preserveUserDataDir for Stagehand when profile is configured
        settings.browser.stagehand = {
          ...settings.browser.stagehand,
          env: settings.browser.stagehand?.env ?? 'LOCAL',
          preserveUserDataDir: true,
        };
        // Profile is a launch option — incompatible with CDP connection
        if (settings.browser.cdpUrl) {
          delete settings.browser.cdpUrl;
          ctx.showInfo(`Note: Cleared cdpUrl (incompatible with profile).`);
        }
        break;
      case 'executablepath':
        settings.browser.executablePath = expandedValue;
        // ExecutablePath is a launch option — incompatible with CDP connection
        if (settings.browser.cdpUrl) {
          delete settings.browser.cdpUrl;
          ctx.showInfo(`Note: Cleared cdpUrl (incompatible with executablePath).`);
        }
        break;
      case 'storagestate':
        if (browser.provider !== 'agent-browser') {
          ctx.showError('storageState is only supported by agent-browser provider.');
          return;
        }
        settings.browser.agentBrowser = {
          ...settings.browser.agentBrowser,
          storageState: expandedValue,
        };
        break;
      case 'cdpurl':
        settings.browser.cdpUrl = expandedValue;
        // CDP connects to an existing browser — launch options are ignored
        if (settings.browser.profile || settings.browser.executablePath) {
          delete settings.browser.profile;
          delete settings.browser.executablePath;
          if (settings.browser.stagehand) {
            delete settings.browser.stagehand.preserveUserDataDir;
          }
          ctx.showInfo(`Note: Cleared profile and executablePath (ignored when using cdpUrl).`);
        }
        if (settings.browser.agentBrowser?.storageState) {
          delete settings.browser.agentBrowser.storageState;
        }
        break;
    }

    saveSettings(settings);
    ctx.showInfo(`Set ${args[1]} = ${expandedValue}\nRun /browser on to apply.`);
    return;
  }

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
      if (activeSettings.executablePath) lines.push(`  Executable: ${activeSettings.executablePath}`);
      if (activeSettings.profile) lines.push(`  Profile: ${activeSettings.profile}`);
      if (activeSettings.agentBrowser?.storageState)
        lines.push(`  Storage State: ${activeSettings.agentBrowser.storageState}`);
      if (activeSettings.cdpUrl) lines.push(`  CDP URL: ${activeSettings.cdpUrl}`);

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
      if (browser.executablePath) lines.push(`  Executable: ${browser.executablePath}`);
      if (browser.profile) lines.push(`  Profile: ${browser.profile}`);
      if (browser.agentBrowser?.storageState) lines.push(`  Storage State: ${browser.agentBrowser.storageState}`);
      if (browser.cdpUrl) lines.push(`  CDP URL: ${browser.cdpUrl}`);

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
      if (browser.executablePath) {
        lines.push(`  Executable: ${browser.executablePath}`);
      }
      if (browser.profile) {
        lines.push(`  Profile: ${browser.profile}`);
      }
      if (browser.agentBrowser?.storageState) {
        lines.push(`  Storage State: ${browser.agentBrowser.storageState}`);
      }
      if (browser.cdpUrl) {
        lines.push(`  CDP URL: ${browser.cdpUrl}`);
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

    // Check for provider mismatch in profile
    const shouldProceed = await checkAndConfirmProviderMismatch(ctx, nextBrowser.profile, nextBrowser.provider);
    if (!shouldProceed) {
      ctx.showInfo('Browser enable cancelled.');
      return;
    }

    try {
      const browserInstance = await createBrowserFromSettings(nextBrowser);
      applyBrowserToAgents(ctx, browserInstance, nextBrowser);
      if (nextBrowser.profile && nextBrowser.provider) {
        setProfileProvider(nextBrowser.profile, nextBrowser.provider);
      }
      settings.browser = nextBrowser;
      saveSettings(settings);
      const providerLabel = browser.provider === 'stagehand' ? 'Stagehand' : 'AgentBrowser';
      ctx.showInfo(`Browser enabled (${providerLabel}).`);
    } catch (err) {
      ctx.showError(`Failed to enable browser: ${err instanceof Error ? err.message : String(err)}`);
    }
    return;
  }

  // /browser clear [field] - reset all or specific setting (preserves enabled state)
  if (arg === 'clear') {
    const field = args[1]?.toLowerCase();

    if (!field) {
      // Clear all - reset to defaults but preserve enabled state
      const wasEnabled = settings.browser.enabled;
      settings.browser = {
        enabled: wasEnabled,
        provider: 'stagehand',
        headless: false,
        viewport: { width: 1280, height: 720 },
      };
      saveSettings(settings);
      // If it was enabled, we need to recreate the browser with new settings
      if (wasEnabled) {
        try {
          const browserInstance = await createBrowserFromSettings(settings.browser);
          applyBrowserToAgents(ctx, browserInstance, settings.browser);
        } catch (err) {
          // If recreation fails, disable and report
          settings.browser.enabled = false;
          saveSettings(settings);
          applyBrowserToAgents(ctx, undefined);
          ctx.showError(
            `Browser settings reset, but failed to restart: ${err instanceof Error ? err.message : String(err)}`,
          );
          return;
        }
      } else {
        applyBrowserToAgents(ctx, undefined);
      }
      ctx.showInfo('Browser settings reset to defaults.');
      return;
    }

    // Clear specific field
    switch (field) {
      case 'profile':
        delete settings.browser.profile;
        if (settings.browser.stagehand) {
          delete settings.browser.stagehand.preserveUserDataDir;
        }
        break;
      case 'executablepath':
        delete settings.browser.executablePath;
        break;
      case 'storagestate':
        if (settings.browser.agentBrowser) {
          delete settings.browser.agentBrowser.storageState;
        }
        break;
      case 'cdpurl':
        delete settings.browser.cdpUrl;
        break;
      default:
        ctx.showError(`Unknown field: ${field}. Valid fields: profile, executablePath, storageState, cdpUrl`);
        return;
    }

    saveSettings(settings);
    ctx.showInfo(`Cleared ${field}. Run /browser on to apply.`);
    return;
  }

  // /browser export storageState <path> - export current session's storage state
  if (arg === 'export') {
    const what = args[1]?.toLowerCase();
    const exportPath = args.slice(2).join(' ').trim();

    if (what !== 'storagestate' && what !== 'storage-state') {
      ctx.showError('Usage: /browser export storageState <path>');
      return;
    }

    if (!exportPath) {
      ctx.showError('Missing path. Usage: /browser export storageState <path>');
      return;
    }

    if (browser.provider !== 'agent-browser') {
      ctx.showError('export storageState is only supported by agent-browser provider.');
      return;
    }

    // Get browser instance from the current mode's agent
    const currentMode = ctx.harness.getCurrentMode();
    const agent =
      typeof currentMode.agent === 'function' ? currentMode.agent(ctx.state.harness.getState()) : currentMode.agent;
    const browserInstance = agent.browser;

    if (!browserInstance) {
      ctx.showError('Browser not enabled. Run /browser on first.');
      return;
    }

    const { AgentBrowser } = await import('@mastra/agent-browser');
    if (!(browserInstance instanceof AgentBrowser)) {
      ctx.showError('Current browser instance does not support exporting storage state.');
      return;
    }

    const expandedPath = exportPath.replace(/^~/, process.env.HOME || '~');

    try {
      await browserInstance.exportStorageState(expandedPath);
      ctx.showInfo(`Storage state exported to: ${expandedPath}`);
    } catch (error) {
      ctx.showError(`Failed to export storage state: ${error instanceof Error ? error.message : String(error)}`);
    }
    return;
  }

  // /browser help, --help, -h, or unrecognized command
  if (arg && !['set', 'status', 'on', 'off', 'enable', 'disable', 'export'].includes(arg)) {
    const help = [
      'usage: /browser <command> [options]',
      '',
      '  (no command)   Interactive setup wizard',
      '  on, enable     Enable browser with current settings',
      '  off, disable   Disable browser',
      '  status         Show current configuration',
      '  clear          Reset all settings to defaults',
      '  clear <key>    Clear: profile, executablePath, storageState, cdpUrl',
      '  set <key> <v>  Set: profile, executablePath, storageState, cdpUrl',
      '  export storageState <path>  Export session cookies/localStorage (agent-browser)',
    ];
    ctx.showInfo(help.join('\n'));
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

  // Step 5: Launch mode (bundled, custom executable, or CDP)
  let profile = browser.profile;
  let executablePath = browser.executablePath;
  let storageState = browser.agentBrowser?.storageState;
  let cdpUrl = browser.cdpUrl;

  // Only show launch mode options for local browsers (not Browserbase)
  if (!isBrowserbase) {
    const launchMode = await askInline(ctx, 'How do you want to launch the browser?', [
      { label: 'Bundled browser', description: 'Use built-in Chromium (recommended)' },
      { label: 'Custom executable', description: 'Use Chrome, Brave, Edge, etc.' },
      { label: 'Connect via CDP', description: 'Connect to an already-running browser' },
    ]);

    if (!launchMode) {
      ctx.showInfo('Browser setup cancelled.');
      return;
    }

    if (launchMode === 'Custom executable') {
      // Clear cdpUrl when using custom browser (mutually exclusive)
      cdpUrl = undefined;

      const execPath = await askText(ctx, 'Browser executable path:', executablePath);
      if (execPath === null) {
        ctx.showInfo('Browser setup cancelled.');
        return;
      }
      executablePath = execPath.replace(/^~/, process.env.HOME || '~');
    } else if (launchMode === 'Connect via CDP') {
      const cdpUrlInput = await askText(ctx, 'CDP WebSocket URL (e.g., ws://localhost:9222):', cdpUrl);
      if (cdpUrlInput === null) {
        ctx.showInfo('Browser setup cancelled.');
        return;
      }
      cdpUrl = cdpUrlInput;
      // Clear launch options when using CDP (they don't apply)
      profile = undefined;
      executablePath = undefined;
      storageState = undefined;
    } else {
      // Bundled browser - clear custom paths
      cdpUrl = undefined;
      executablePath = undefined;
    }

    // Step 6: Profile option (only for bundled or custom executable, not CDP)
    if (launchMode !== 'Connect via CDP') {
      const useProfile = await askInline(ctx, 'Use a browser profile?', [
        { label: 'No', description: 'Fresh session each time' },
        { label: 'Yes', description: 'Persist logins, cookies, extensions' },
      ]);

      if (!useProfile) {
        ctx.showInfo('Browser setup cancelled.');
        return;
      }

      if (useProfile === 'Yes') {
        const defaultProfile = `~/.mastracode/browser-profile-${provider}`;
        const profilePath = await askText(ctx, 'Profile directory path:', profile || defaultProfile);
        if (profilePath === null) {
          ctx.showInfo('Browser setup cancelled.');
          return;
        }
        profile = profilePath.replace(/^~/, process.env.HOME || '~');
      } else {
        profile = undefined;
      }
    }
  }

  // Build new browser settings
  // Auto-set preserveUserDataDir when profile is configured for Stagehand
  if (provider === 'stagehand' && profile && stagehandSettings) {
    stagehandSettings.preserveUserDataDir = true;
  }

  const nextBrowser: BrowserSettings = {
    enabled: true,
    provider,
    headless,
    viewport: browser.viewport ?? { width: 1280, height: 720 },
    cdpUrl,
    profile,
    executablePath,
    stagehand: stagehandSettings,
    agentBrowser: storageState ? { storageState } : undefined,
  };

  // Check for provider mismatch in profile
  const shouldProceed = await checkAndConfirmProviderMismatch(ctx, profile, provider);
  if (!shouldProceed) {
    ctx.showInfo('Browser setup cancelled.');
    return;
  }

  // Apply browser to agents first, then persist on success
  try {
    const browserInstance = await createBrowserFromSettings(nextBrowser);
    applyBrowserToAgents(ctx, browserInstance, nextBrowser);
    if (nextBrowser.profile && nextBrowser.provider) {
      setProfileProvider(nextBrowser.profile, nextBrowser.provider);
    }
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

  // Show advanced options if configured
  if (cdpUrl) {
    summary.push(`  CDP URL: ${cdpUrl}`);
  }
  if (executablePath) {
    summary.push(`  Executable: ${executablePath}`);
  }
  if (profile) {
    summary.push(`  Profile: ${profile}`);
  }
  if (storageState) {
    summary.push(`  Storage State: ${storageState}`);
  }

  ctx.showInfo(summary.join('\n'));
}
