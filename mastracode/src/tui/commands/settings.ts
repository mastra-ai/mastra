import { execFile, spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { Box, Spacer, Text, matchesKey } from '@earendil-works/pi-tui';
import type { TUI } from '@earendil-works/pi-tui';
import type { StorageBackend, ThinkingLevelSetting } from '../../onboarding/settings';
import { loadSettings, saveSettings } from '../../onboarding/settings';
import { SettingsComponent } from '../components/settings';
import type { IToolExecutionComponent } from '../components/tool-execution-interface';
import { askModalQuestion } from '../modal-question';
import type { NotificationMode } from '../notify';
import { showModalOverlay } from '../overlay';
import { handleApiKeysCommand } from './api-keys';
import type { SlashCommandContext } from './types';

function getCurrentModeColor(ctx: SlashCommandContext): string | undefined {
  const color = ctx.state.session.mode.resolve().metadata?.color;
  return typeof color === 'string' ? color : undefined;
}

function commandExists(command: string): Promise<boolean> {
  return new Promise(resolve => {
    execFile('/bin/sh', ['-lc', `command -v ${command}`], error => resolve(!error));
  });
}

class GitcrawlSetupProgress extends Box {
  private lines: string[] = [];
  private _focused = false;

  constructor(
    private title: string,
    private command: string,
    private onCancel: () => void,
  ) {
    super(2, 1);
    this.rebuild();
  }

  get focused(): boolean {
    return this._focused;
  }

  set focused(value: boolean) {
    this._focused = value;
  }

  handleInput(data: string): void {
    if (matchesKey(data, 'escape') || data === '\x1b' || data === '\x1b\x1b') {
      this.onCancel();
    }
  }

  addOutput(chunk: Buffer | string): void {
    const text = chunk.toString();
    const lines = text
      .split(/\r?\n/)
      .map(line => line.trimEnd())
      .filter(Boolean);
    this.lines = [...this.lines, ...lines].slice(-4);
    this.rebuild();
  }

  private rebuild(): void {
    this.clear();
    this.addChild(new Text(this.title, 0, 0));
    this.addChild(new Text(this.command, 0, 0));
    this.addChild(new Text('Press Esc to cancel.', 0, 0));
    this.addChild(new Spacer(1));
    const output = this.lines.length > 0 ? this.lines : ['Waiting for Homebrew output...'];
    for (const line of output) {
      this.addChild(new Text(line, 0, 0));
    }
  }
}

function runGitcrawlSetupCommand(
  tui: TUI,
  title: string,
  command: string,
  executable: string,
  args: string[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      overlay.hide();
      callback();
    };
    const progress = new GitcrawlSetupProgress(title, command, () => {
      child.kill('SIGTERM');
      finish(() => reject(new Error(`${title} cancelled`)));
    });
    const overlay = showModalOverlay(tui, progress, { maxHeight: '50%' });
    overlay.focus();

    child.stdout.on('data', chunk => {
      progress.addOutput(chunk);
      tui.requestRender();
    });
    child.stderr.on('data', chunk => {
      progress.addOutput(chunk);
      tui.requestRender();
    });
    child.on('error', error => finish(() => reject(error)));
    child.on('close', code => {
      finish(() => {
        if (code === 0) resolve();
        else reject(new Error(`${command} exited with code ${code}`));
      });
    });
  });
}

function installGitcrawl(tui: TUI): Promise<void> {
  return runGitcrawlSetupCommand(tui, 'Installing gitcrawl', 'brew install openclaw/tap/gitcrawl', 'brew', [
    'install',
    'openclaw/tap/gitcrawl',
  ]);
}

function gitcrawlConfigPath(): string {
  return join(homedir(), '.config', 'gitcrawl', 'config.toml');
}

async function gitcrawlConfigExists(): Promise<boolean> {
  try {
    await access(gitcrawlConfigPath());
    return true;
  } catch {
    return false;
  }
}

function initGitcrawl(tui: TUI): Promise<void> {
  return runGitcrawlSetupCommand(tui, 'Configuring gitcrawl', 'gitcrawl init --json', 'gitcrawl', ['init', '--json']);
}

async function ensureGitcrawlInstalled(ctx: SlashCommandContext): Promise<boolean> {
  if (await commandExists('gitcrawl')) return true;

  const answer = await askModalQuestion(ctx.state.ui, {
    question: 'gitcrawl is required for GitHub signals. Install it with Homebrew now?',
    options: [
      { label: 'Install', description: 'Run: brew install openclaw/tap/gitcrawl' },
      { label: 'Cancel', description: 'Leave GitHub signals disabled' },
    ],
  });
  if (answer !== 'Install') return false;

  await installGitcrawl(ctx.state.ui);
  return true;
}

async function ensureGitcrawlConfigured(ctx: SlashCommandContext): Promise<boolean> {
  if (await gitcrawlConfigExists()) return true;

  await initGitcrawl(ctx.state.ui);
  return true;
}

async function ensureGitcrawlReady(ctx: SlashCommandContext): Promise<boolean> {
  try {
    return (await ensureGitcrawlInstalled(ctx)) && (await ensureGitcrawlConfigured(ctx));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.endsWith(' cancelled')) ctx.showInfo(`${message}.`);
    else ctx.showError(`Failed to set up gitcrawl: ${message}`);
    return false;
  }
}

function applyQuietModeToRenderedTools(ctx: SlashCommandContext, enabled: boolean, previewLineLimit: number): void {
  const tools = ctx.state.allToolComponents.filter(
    (tool): tool is IToolExecutionComponent => typeof tool.setQuietModeDisplay === 'function',
  );

  tools.forEach(tool => {
    tool.setCompactToolModeColor?.(getCurrentModeColor(ctx));
    tool.setQuietModeDisplay?.(enabled ? 'quiet' : 'normal');
    tool.setQuietPreviewLineLimit?.(previewLineLimit);
  });

  ctx.state.ui.requestRender();
}

export async function handleSettingsCommand(ctx: SlashCommandContext): Promise<void> {
  const state = ctx.state.session.state.get() as any;
  const globalSettings = loadSettings();
  const config = {
    notifications: (state?.notifications ?? 'off') as NotificationMode,
    yolo: state?.yolo === true,
    thinkingLevel: (state?.thinkingLevel ?? 'off') as string,
    currentModelId: ctx.state.session.model.get() ?? '',
    escapeAsCancel: ctx.state.editor.escapeEnabled,
    quietMode: globalSettings.preferences.quietMode,
    quietModeMaxToolPreviewLines: globalSettings.preferences.quietModeMaxToolPreviewLines,
    storageBackend: globalSettings.storage.backend,
    pgConnectionString: globalSettings.storage.pg?.connectionString ?? '',
    libsqlUrl: globalSettings.storage.libsql?.url ?? '',
    experimentalGithubSignals: globalSettings.signals.experimentalGithubSignals,
  };

  return new Promise<void>(resolve => {
    const settings = new SettingsComponent(config, {
      onNotificationsChange: async mode => {
        await ctx.state.session.state.set({ notifications: mode });
        ctx.showInfo(`Notifications: ${mode}`);
      },
      onYoloChange: async enabled => {
        await ctx.state.session.state.set({ yolo: enabled } as any);
      },
      onThinkingLevelChange: async level => {
        await ctx.state.session.state.set({ thinkingLevel: level } as any);
        const current = loadSettings();
        current.preferences.thinkingLevel = level as ThinkingLevelSetting;
        saveSettings(current);
      },
      onEscapeAsCancelChange: async enabled => {
        ctx.state.editor.escapeEnabled = enabled;
        await ctx.state.session.state.set({ escapeAsCancel: enabled });
        await ctx.state.session.thread.setSetting({ key: 'escapeAsCancel', value: enabled });
      },
      onQuietModeChange: enabled => {
        const current = loadSettings();
        current.preferences.quietMode = enabled;
        current.onboarding.quietModePreferenceSelected = true;
        saveSettings(current);
        ctx.state.quietMode = enabled;
        ctx.state.taskProgress?.setQuietMode(enabled);
        applyQuietModeToRenderedTools(ctx, enabled, ctx.state.quietModeMaxToolPreviewLines);
      },
      onQuietModeMaxToolPreviewLinesChange: lines => {
        const current = loadSettings();
        current.preferences.quietModeMaxToolPreviewLines = lines;
        saveSettings(current);
        ctx.state.quietModeMaxToolPreviewLines = lines;
        applyQuietModeToRenderedTools(ctx, ctx.state.quietMode, lines);
      },
      onStorageBackendChange: (backend: StorageBackend, connectionUrl?: string) => {
        const current = loadSettings();
        current.storage.backend = backend;
        if (backend === 'pg' && connectionUrl !== undefined) {
          current.storage.pg = { ...current.storage.pg, connectionString: connectionUrl };
        } else if (backend === 'libsql') {
          current.storage.libsql = { ...current.storage.libsql, url: connectionUrl || undefined };
        }
        saveSettings(current);
        ctx.state.ui.hideOverlay();
        ctx.stop();
        const label = backend === 'pg' ? 'PostgreSQL' : 'LibSQL';
        console.info(`\nStorage backend changed to ${label}. Restarting is required.\n`);
        process.exit(0);
      },
      onExperimentalGithubSignalsChange: async enabled => {
        if (enabled && !(await ensureGitcrawlReady(ctx))) return false;
        const current = loadSettings();
        current.signals.experimentalGithubSignals = enabled;
        saveSettings(current);
        ctx.showInfo(`Experimental GitHub signals: ${enabled ? 'on' : 'off'} (restart required)`);
        return true;
      },
      onApiKeys: () => {
        ctx.state.ui.hideOverlay();
        resolve();
        handleApiKeysCommand(ctx);
      },
      onClose: () => {
        ctx.state.ui.hideOverlay();
        resolve();
      },
    });

    showModalOverlay(ctx.state.ui, settings, { maxHeight: '75%' });
    settings.focused = true;
  });
}
