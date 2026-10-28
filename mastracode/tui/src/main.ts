#!/usr/bin/env node
/**
 * Main entry point for Mastra Code TUI.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';

import { createMastraCode, resolveSubagentsSetting } from '@mastra/code-sdk';
import { createMastraCodeAnalytics } from '@mastra/code-sdk/analytics';
import { isStreamDestroyedError } from '@mastra/code-sdk/error-classification';
import { RemoteController } from '@mastra/code-sdk/factory/remote-controller';
import { RemoteSession } from '@mastra/code-sdk/factory/remote-session';
import { hasHeadlessFlag, runMCCli } from '@mastra/code-sdk/headless/index';
import { resolveModePackArg } from '@mastra/code-sdk/onboarding/pack-activation';
import {
  createBrowserFromSettings,
  loadSettings,
  resolveStagehandModel,
  toActiveBrowserSettings,
} from '@mastra/code-sdk/onboarding/settings';
import type { FactoryConnectionSettings } from '@mastra/code-sdk/onboarding/settings';
import { getPlatformSession } from '@mastra/code-sdk/platform/index';
import { formatScaffoldSuccess, scaffoldPlugin } from '@mastra/code-sdk/plugins/scaffold';
import { stopProcessMemoryDiagnosticsWithTimeout } from '@mastra/code-sdk/process-memory-diagnostics';
import type { ProcessMemoryDiagnostics } from '@mastra/code-sdk/process-memory-diagnostics';
import { setupDebugLogging, truncateLogFile } from '@mastra/code-sdk/utils/debug-log';
import { drainPipedStdin, reopenStdinFromTTY } from '@mastra/code-sdk/utils/stdin-pipe';
import { releaseAllThreadLocks } from '@mastra/code-sdk/utils/thread-lock';
import {
  activeBrowserGeneration,
  closeActiveBrowser,
  discardBrowser,
  replaceActiveBrowser,
} from './browser-lifecycle.js';
import { TUI_CO_AUTHOR } from './commit-attribution.js';
import { initialMessageOptions, pipedInputConflict, takeInitialPrompt, takePackFlag } from './initial-prompt.js';
import {
  createOneShotFatalErrorHandler,
  createShutdownCoordinator,
  startTuiProcessMemoryDiagnostics,
} from './process-memory-diagnostics-lifecycle.js';
import {
  formatResumeHint,
  parseResumeThreadId,
  shouldRejectResumeWithoutTTY,
  shouldRunHeadless,
} from './resume-command.js';
import { applyThemePreference, normalizeThemePreference } from './tui/commands/theme.js';
import { MastraTUI } from './tui/index.js';
import { getUpdateCommandArgs, runUpdateCommand } from './update-command.js';
import { getCurrentVersion } from './version.js';

let controller: Awaited<ReturnType<typeof createMastraCode>>['controller'];
let mcpManager: Awaited<ReturnType<typeof createMastraCode>>['mcpManager'];
let hookManager: Awaited<ReturnType<typeof createMastraCode>>['hookManager'];
let authStorage: Awaited<ReturnType<typeof createMastraCode>>['authStorage'];
let signalsPubSub: Awaited<ReturnType<typeof createMastraCode>>['signalsPubSub'];
let storageMaintenance: Awaited<ReturnType<typeof createMastraCode>>['storageMaintenance'];
let stopPluginSignalProviders: Awaited<ReturnType<typeof createMastraCode>>['stopPluginSignalProviders'] | undefined;
let threadScheduler: Awaited<ReturnType<typeof createMastraCode>>['threadScheduler'] | undefined;
let stopNotificationDispatch: Awaited<ReturnType<typeof createMastraCode>>['stopNotificationDispatch'] | undefined;
let releaseThreadClaims: Awaited<ReturnType<typeof createMastraCode>>['releaseThreadClaims'] | undefined;
let analytics: ReturnType<typeof createMastraCodeAnalytics> | undefined;
let tui: MastraTUI | undefined;
let processMemoryDiagnostics: ProcessMemoryDiagnostics | undefined;
let storageClosed = false;
let cleanupPromise: Promise<void> | null = null;
let getResumeThreadId: (() => string | null) | undefined;
let remoteSession: RemoteSession | undefined;

const CRASH_LOG_PATH = '/tmp/mastra-crash.log';

function isTruthyEnv(name: string): boolean {
  return ['1', 'true', 'yes', 'on'].includes(process.env[name]?.trim().toLowerCase() ?? '');
}

function resolveInitialStateFromEnv(options: { ignoreModelEnv?: boolean } = {}) {
  const currentModelId = options.ignoreModelEnv ? undefined : process.env.MASTRACODE_MODEL_ID?.trim();
  const initialState: Record<string, unknown> = {};
  if (currentModelId) initialState.currentModelId = currentModelId;
  if (isTruthyEnv('MASTRACODE_YOLO')) initialState.yolo = true;
  return Object.keys(initialState).length > 0 ? initialState : undefined;
}

// Global safety nets — catch any uncaught errors from storage init, etc.
process.on('uncaughtException', error => {
  // ERR_STREAM_DESTROYED is non-fatal — happens routinely when streams close
  // during shutdown, cancelled LLM requests, or LSP/subprocess exits (#13548, #13549)
  if (isStreamDestroyedError(error)) return;
  handleFatalError(error);
});
process.on('unhandledRejection', reason => {
  if (isStreamDestroyedError(reason)) return;
  handleFatalError(reason instanceof Error ? reason : new Error(String(reason)));
});

type StartupMessage = ReturnType<typeof initialMessageOptions>;

async function tuiMain(startupMessage: StartupMessage = {}, resumeThreadId?: string, startupPackId?: string) {
  const settings = loadSettings();
  processMemoryDiagnostics = await startTuiProcessMemoryDiagnostics(process.env, warning => {
    console.info(`⚠ ${warning}`);
  });

  setupDebugLogging();

  // Detect and apply terminal theme
  // MASTRA_THEME env var is the highest-priority override (mode name or custom theme name)
  const envTheme = normalizeThemePreference(process.env.MASTRA_THEME ?? '');
  const themeMode = envTheme || settings.preferences.theme || 'auto';
  await applyThemePreference(themeMode);

  analytics = createMastraCodeAnalytics({ version: getCurrentVersion() });
  if (settings.factory && settings.factory.active !== false && !isTruthyEnv('MASTRACODE_LOCAL')) {
    const ignored = [resumeThreadId && 'thread resume', startupPackId && 'model pack'].filter(Boolean);
    if (ignored.length > 0) console.info(`⚠ Factory mode ignores the requested ${ignored.join(' and ')}.`);
    try {
      return await bootFactory(settings.factory, themeMode, startupMessage);
    } catch (error) {
      // Never lock the user out of the TUI: they need it running to reconnect or disconnect.
      console.info(
        `⚠ Could not reach Factory ${settings.factory.factoryProjectName} (${(error as Error).message}). ` +
          'Running locally — use /factory to retry or /factory disconnect to forget it.',
      );
    }
  }
  return bootLocal(settings, themeMode, startupMessage, resumeThreadId, startupPackId);
}

/**
 * Factory client: the agent, tools, storage, and model auth live in the Factory.
 * Nothing local is constructed; the TUI only renders and forwards input.
 */
async function bootFactory(factory: FactoryConnectionSettings, themeMode: string, startupMessage: StartupMessage) {
  const platform = await getPlatformSession();
  if (!platform) throw new Error('Mastra Platform login expired');
  const address = { url: factory.url, session: { token: platform.token, orgId: factory.orgId } };
  const session = new RemoteSession(address, factory.sessionId);
  const remoteController = new RemoteController(address);
  try {
    await Promise.all([session.connect(), remoteController.connect()]);
  } catch (error) {
    session.disconnect();
    throw error;
  }
  remoteSession = session;
  session.setModes(remoteController.listModes());
  getResumeThreadId = () => (tui ? tui.getResumeThreadId() : session.thread.getId());

  analytics?.capture('mastracode_session_started', {
    mode: session.mode.get(),
    resourceId: session.identity.getResourceId(),
    runtime: 'factory',
    theme: themeMode,
  });

  tui = new MastraTUI({
    runtime: 'factory',
    controller: remoteController,
    session,
    factory: {
      projectName: factory.factoryProjectName,
      repositorySlug: factory.repositorySlug,
      branch: factory.branch,
      url: factory.url,
    },
    analytics,
    processMemoryDiagnostics,
    appName: 'Mastra Code',
    version: getCurrentVersion(),
    inlineQuestions: true,
    exit: exitCode => void shutdownAndExit(exitCode),
    relaunch,
    ...startupMessage,
  });
  tui.run().catch(error => {
    handleFatalError(error);
  });
}

async function bootLocal(
  settings: ReturnType<typeof loadSettings>,
  themeMode: string,
  startupMessage: StartupMessage,
  resumeThreadId?: string,
  startupPackId?: string,
) {
  let browserPromise: ReturnType<typeof createBrowserFromSettings> | undefined;
  const loadBrowser = (chatModelId: string | undefined) => {
    browserPromise ??= createBrowserFromSettings(settings.browser, { chatModelId });
    return browserPromise;
  };

  const initialState = resolveInitialStateFromEnv({ ignoreModelEnv: startupPackId !== undefined });
  const result = await createMastraCode({
    createInitialThread: false,
    coAuthor: TUI_CO_AUTHOR,
    unixSocketPubSub: !isTruthyEnv('MASTRACODE_DISABLE_UNIX_SOCKET_PUBSUB'),
    disableMcp: isTruthyEnv('MASTRACODE_DISABLE_MCP'),
    disableHooks: isTruthyEnv('MASTRACODE_DISABLE_HOOKS'),
    subagents: resolveSubagentsSetting(settings.preferences.subagentsEnabled),
    ...(isTruthyEnv('MASTRACODE_DISABLE_MEMORY') ? { memory: false as never } : {}),
    ...(initialState ? { initialState: initialState as never } : {}),
  });
  controller = result.controller;
  mcpManager = result.mcpManager;
  hookManager = result.hookManager;
  authStorage = result.authStorage;
  signalsPubSub = result.signalsPubSub;
  storageMaintenance = result.storageMaintenance;
  stopPluginSignalProviders = result.stopPluginSignalProviders;
  threadScheduler = result.threadScheduler;
  stopNotificationDispatch = result.stopNotificationDispatch;
  releaseThreadClaims = result.releaseThreadClaims;

  if (result.storageWarning) {
    console.info(`⚠ ${result.storageWarning}`);
  }
  if (result.observabilityWarning) {
    console.info(`⚠ ${result.observabilityWarning}`);
  }

  // MCP connection is deferred to TUI.init() (after ui.start()) so that
  // status messages use showInfo() instead of console.info(), which would
  // corrupt the terminal.  Headless mode still inits from headless/cli.ts.

  // createMastraCode() brought up shared resources and minted the single
  // session that all work runs through. The AgentController owns no session of its own.
  const session = result.session;
  getResumeThreadId = () => (tui ? tui.getResumeThreadId() : session.thread.getId());

  analytics?.capture('mastracode_session_started', {
    mode: session.mode.get(),
    resourceId: session.identity.getResourceId(),
    hasAuthStorage: Boolean(authStorage),
    hasMcp: Boolean(mcpManager),
    theme: themeMode,
    runtime: 'local',
  });

  tui = new MastraTUI({
    controller,
    session,
    hookManager,
    analytics,
    authStorage,
    mcpManager,
    pluginManager: result.pluginManager,
    storageMaintenance: result.storageMaintenance,
    processMemoryDiagnostics,
    knowledgeInspector: result.knowledgeInspector,
    knowledgeInspectorUnavailableReason: result.knowledgeInspectorUnavailableReason,
    threadScheduler: result.threadScheduler,
    appName: 'Mastra Code',
    version: getCurrentVersion(),
    inlineQuestions: true,
    initialModelOverride: Boolean(initialState?.currentModelId),
    ...(startupPackId ? { initialPackId: startupPackId } : {}),
    ...(resumeThreadId ? { resumeThreadId } : {}),
    githubSignals: result.githubSignals,
    backgroundToolsEnabled: result.backgroundToolsEnabled,
    backgroundCompletionEvents: result.backgroundCompletionEvents,
    exit: exitCode => void shutdownAndExit(exitCode),
    relaunch,
    ...startupMessage,
  });
  tui.run().catch(error => {
    handleFatalError(error);
  });

  if (settings.browser.enabled) {
    // Captured once: the Stagehand instance is fixed at launch and shared by every thread.
    const chatModelId = session.model.get();
    // The TUI is already running, so /browser can replace the browser while this one loads.
    const startGeneration = activeBrowserGeneration();
    void loadBrowser(chatModelId)
      .then(async browser => {
        if (!browser) return;
        if (activeBrowserGeneration() !== startGeneration) {
          await discardBrowser(browser);
          return;
        }
        if (!(await replaceActiveBrowser(browser))) return;
        controller.setBrowser(browser);
        void session.state
          .set({
            activeBrowserSettings: toActiveBrowserSettings(settings.browser),
            activeBrowserModel: resolveStagehandModel(settings.browser, { chatModelId }),
          } as any)
          .catch(() => {});
      })
      .catch(() => {});
  }
}

const asyncCleanup = (): Promise<void> => {
  cleanupPromise ??= (async () => {
    // A local browser is a detached process holding its profile lock; left
    // running, it breaks the next launch on that profile. Start closing it first
    // so it finishes inside the shutdown deadline whatever the steps below take.
    const browserClosed = closeActiveBrowser();
    releaseAllThreadLocks();
    // Release thread claims before the slow teardown below, so a restarted
    // session can claim its thread (and peers can reach it) right away.
    try {
      releaseThreadClaims?.();
    } catch {
      // Best-effort — the process is exiting.
    }
    // Stop plugin-contributed signal providers (and the plugin reload listener)
    // before quiescing workers: a provider that keeps polling past this point
    // could dispatch into a controller that is shutting down.
    try {
      stopPluginSignalProviders?.();
    } catch {
      // Best-effort — the process is exiting.
    }
    const diagnosticsShutdown = processMemoryDiagnostics
      ? stopProcessMemoryDiagnosticsWithTimeout(processMemoryDiagnostics, message => console.warn(message))
      : undefined;
    // Schedules live only in this process; stop their timers so none fires mid-shutdown.
    threadScheduler?.stop();
    // Release this process's notification dispatch leases before the pubsub that holds them closes.
    await stopNotificationDispatch?.().catch(() => {});
    remoteSession?.disconnect();
    await Promise.allSettled([mcpManager?.disconnect(), controller?.stopIntervals(), browserClosed]);
    // Mastra owns the workspaces and must destroy them to stop retained language
    // servers before storage is closed.
    await Promise.allSettled([controller?.getMastra()?.shutdown(), analytics?.shutdown()]);
    // The signals pubsub is Mastra's event bus: in-flight runs and background
    // tasks drain through it during shutdown, so close it only afterwards. Call
    // close() on the object; a detached method loses `this` and rejects silently.
    const pubsubToClose = signalsPubSub as { close?: () => Promise<void> | void } | undefined;
    await Promise.allSettled([pubsubToClose?.close?.()]);
    // Checkpoint WAL and close the local storage connection after all producers
    // and timers are quiesced. Idempotent — repeated signals (SIGINT then SIGHUP)
    // close only once. LibSQLStore.close()/LibSQLVector.close() truncate the WAL
    // and switch back to DELETE journal mode for a clean shutdown.
    if (!storageClosed) {
      storageClosed = true;
      await storageMaintenance?.closeStorage?.().catch(() => {
        // Swallow — best-effort cleanup during shutdown. The process is exiting.
      });
    }
    await diagnosticsShutdown;
  })();
  return cleanupPromise;
};

/**
 * Restart Mastra Code so it boots in whichever mode settings now select. The
 * startup prompt and resume flags are dropped: they were for the previous run.
 */
async function relaunch(): Promise<void> {
  await asyncCleanup();
  tui?.stop();
  const env = { ...process.env };
  delete env.MASTRACODE_LOCAL;
  const args = [...process.execArgv, process.argv[1]!];
  const execve = (process as { execve?: (file: string, args: string[], env: NodeJS.ProcessEnv) => never }).execve;
  if (execve) execve(process.execPath, [process.execPath, ...args], env);
  // No in-place exec (Windows, older Node): hand the terminal to a child and mirror its exit.
  // The child shares the terminal's process group and handles Ctrl+C itself.
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.removeAllListeners(signal);
    process.on(signal, () => {});
  }
  // Release stdin so the child is the only reader of terminal input.
  process.stdin.removeAllListeners('data');
  process.stdin.pause();
  const child = spawn(process.execPath, args, { stdio: 'inherit', env });
  child.on('error', error => {
    console.error(`Failed to restart Mastra Code: ${error.message}`);
    process.exit(1);
  });
  child.on('exit', code => process.exit(code ?? 0));
}

const shutdownAndExit = createShutdownCoordinator(asyncCleanup, exitCode => process.exit(exitCode));

process.on('beforeExit', () => {
  void asyncCleanup();
});
process.on('exit', () => {
  // Ensure terminal protocols (kitty keyboard, modifyOtherKeys, bracketed paste,
  // raw mode) are disabled on ANY exit path. Without this, killing the process
  // via SIGINT/SIGTERM leaves the terminal in a corrupted state where keypresses
  // produce escape sequences like "5;99~" instead of normal characters.
  try {
    tui?.stop();
  } catch {
    // Failsafe: even if MastraTUI.stop() throws, write raw terminal reset
    // sequences to disable Kitty keyboard protocol, bracketed paste, and
    // modifyOtherKeys. These are the exact sequences pi-tui's terminal.stop()
    // would write.
  }
  // Belt-and-suspenders: always write terminal reset sequences directly,
  // regardless of whether tui.stop() succeeded. Writing them twice is harmless
  // but missing them leaves the terminal in a corrupted state.
  try {
    process.stdout.write(
      '\x1b[?2004l' + // disable bracketed paste
        '\x1b[<u' + // pop kitty keyboard protocol
        '\x1b[>4;0m' + // disable modifyOtherKeys
        '\x1b[?25h', // show cursor
    );
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(false);
    }
  } catch {
    // stdout may already be closed during exit
  }
  releaseAllThreadLocks();
  try {
    const threadId = getResumeThreadId?.();
    if (threadId) {
      process.stdout.write(`\n${formatResumeHint(threadId)}\n`);
    }
  } catch {
    // session state or stdout may already be closed during exit
  }
});

// Start durable diagnostics shutdown before synchronous TUI teardown so a stalled
// terminal cleanup cannot prevent the final profile capture. The exit handler still
// provides a failsafe terminal reset if teardown throws.
const handleTermSignal = () => {
  void asyncCleanup();
  try {
    tui?.stop();
  } catch {
    // ignored — exit handler has failsafe reset
  }
  void shutdownAndExit(0);
};
process.on('SIGINT', handleTermSignal);
process.on('SIGTERM', handleTermSignal);
process.on('SIGHUP', handleTermSignal);

function hasEconnrefused(err: unknown, depth = 0): boolean {
  if (!err || depth > 5) return false;
  const e = err as any;
  if (e.code === 'ECONNREFUSED') return true;
  if (e.cause) return hasEconnrefused(e.cause, depth + 1);
  // AggregateError has .errors array
  if (Array.isArray(e.errors)) return e.errors.some((inner: unknown) => hasEconnrefused(inner, depth + 1));
  return false;
}

function pluginMain(args: string[]): void {
  if (args[0] !== 'scaffold') {
    process.stderr.write('Usage: mastracode plugin scaffold <dir> [--id acme.foo] [--name "Foo Tools"]\n');
    process.exit(1);
  }

  const dir = args[1];
  if (!dir) {
    process.stderr.write('Usage: mastracode plugin scaffold <dir> [--id acme.foo] [--name "Foo Tools"]\n');
    process.exit(1);
  }

  const id = readFlag(args, '--id');
  const name = readFlag(args, '--name');
  const targetDir = scaffoldPlugin(dir, { ...(id ? { id } : {}), ...(name ? { name } : {}) });
  process.stdout.write(`${formatScaffoldSuccess(targetDir)}\n`);
}

function readFlag(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

const handleFatalError = createOneShotFatalErrorHandler((error: unknown): void => {
  // Always write to real stderr, even if console.error was overridden
  const write = (msg: string) => {
    try {
      process.stderr.write(msg + '\n');
    } catch {}
  };

  if (hasEconnrefused(error)) {
    const settings = loadSettings();
    const connStr = settings.storage?.pg?.connectionString;
    const target = connStr ?? 'localhost:5432';
    write(
      `\nFailed to connect to PostgreSQL at ${target}.` +
        `\nMake sure the database is running and accessible.` +
        `\n\nTo switch back to LibSQL:` +
        `\n  Set MASTRA_STORAGE_BACKEND=libsql or change the backend in /settings\n`,
    );
    void asyncCleanup();
    try {
      tui?.stop();
    } catch {}
    void shutdownAndExit(1);
    return;
  }

  const msg = `Fatal error: ${error instanceof Error ? error.message : String(error)}`;
  write(msg);
  // Write crash log to file so it persists even if terminal closes
  try {
    const crashLog = `[${new Date().toISOString()}] ${msg}\n${error instanceof Error && error.stack ? error.stack + '\n' : ''}`;
    truncateLogFile(CRASH_LOG_PATH);
    fs.appendFileSync(CRASH_LOG_PATH, crashLog);
    truncateLogFile(CRASH_LOG_PATH);
  } catch {}
  if (error instanceof Error && error.stack) {
    write(error.stack);
  }
  void asyncCleanup();
  try {
    tui?.stop();
  } catch {}
  void shutdownAndExit(1);
});

async function main() {
  if (process.argv[2] === 'plugin') {
    return pluginMain(process.argv.slice(3));
  }

  // Storage maintenance without the TUI, so a database can still be pruned and
  // compacted when the interactive session won't start. Checked before the
  // headless branch below, which would otherwise claim `prune --help`.
  if (process.argv[2] === 'prune') {
    const { runPruneCommand } = await import('@mastra/code-sdk/utils/prune-cli');
    return process.exit(await runPruneCommand(process.argv.slice(3)));
  }

  // Also checked before the headless branch, which would send the bare word as a prompt.
  const updateArgs = getUpdateCommandArgs(process.argv);
  if (updateArgs) {
    const code = await runUpdateCommand({ args: updateArgs, currentVersion: getCurrentVersion() });
    await Promise.all(
      [process.stdout, process.stderr].map(stream => new Promise(resolve => stream.write('', resolve))),
    );
    return process.exit(code);
  }

  const loginIndex = process.argv.findIndex(
    (arg, index) => index >= 2 && arg !== '--acp' && arg !== '--dangerous-auto-approve',
  );
  if (process.argv[loginIndex] === 'login') {
    const { runLoginCommand } = await import('./login-command.js');
    const code = await runLoginCommand({ args: process.argv.slice(loginIndex + 1) });
    await new Promise(resolve => process.stdout.write('', resolve));
    return process.exit(code);
  }

  // --pack is shared with headless mode, which re-parses it from process.argv
  // in runMCCli. Strip it here only for the interactive path's other argv
  // consumers (initial prompt, resume) so the pack id is never mistaken for a
  // positional prompt.
  const packFlag = takePackFlag(process.argv);
  if (packFlag.error) {
    process.stderr.write(`${packFlag.error}\n`);
    process.exit(1);
  }

  const initialPrompt = takeInitialPrompt(packFlag.argv, process.env);
  if (initialPrompt.error) {
    process.stderr.write(`${initialPrompt.error}\n`);
    process.exit(1);
  }
  if (initialPrompt.flag) process.argv = initialPrompt.argv;
  const tuiArgv = initialPrompt.flag ? initialPrompt.argv : packFlag.argv;
  // The flag only means something to the interactive TUI. Paths that can't run
  // it reject the flag instead of dropping the prompt; an env var prompt is
  // just ignored there.
  const rejectInitialPromptFlag = (reason: string) => {
    if (!initialPrompt.flag) return;
    process.stderr.write(`${initialPrompt.flag} starts the interactive TUI; ${reason}\n`);
    process.exit(1);
  };

  let resumeThreadId: string | undefined;
  try {
    resumeThreadId = parseResumeThreadId(tuiArgv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
    return;
  }

  const headless = hasHeadlessFlag(process.argv);
  if (shouldRunHeadless(process.argv, resumeThreadId, headless)) {
    if (headless) rejectInitialPromptFlag('use --prompt for headless runs');
    return runMCCli(undefined, { coAuthor: TUI_CO_AUTHOR });
  }

  if (process.argv.includes('--acp')) {
    rejectInitialPromptFlag('it cannot be combined with --acp');
    const { acpMain } = await import('@mastra/code-sdk/acp/index');
    return acpMain({
      dangerousAutoApprove: process.argv.includes('--dangerous-auto-approve'),
      coAuthor: TUI_CO_AUTHOR,
    });
  }

  // Interactive --pack: fail fast on an unknown pack. Validation and
  // activation (which mirrors /models → Activate and becomes the global
  // default in settings) happen in MastraTUI.init after thread resume, once
  // the resumed session mode is known and the pack is confirmed to have a
  // model for it; the TUI then applies it to the session (and any resumed
  // thread) at startup.
  let startupPackId: string | undefined;
  if (packFlag.value !== undefined) {
    const settings = loadSettings();
    const resolved = resolveModePackArg(settings, packFlag.value);
    if ('error' in resolved) {
      process.stderr.write(`Error: ${resolved.error}\n`);
      process.exit(1);
    }
    startupPackId = resolved.packId;
    if (process.env.MASTRACODE_MODEL_ID?.trim()) {
      process.stderr.write('Note: --pack takes precedence over MASTRACODE_MODEL_ID for this session.\n');
    }
  }

  if (shouldRejectResumeWithoutTTY(resumeThreadId, Boolean(process.stdin.isTTY))) {
    process.stderr.write('mastracode resume requires an interactive terminal.\n');
    process.exitCode = 1;
    return;
  }

  // When stdin is piped (e.g. `cat foo | mastracode`), drain the pipe fully
  // before starting the TUI.  The drain blocks until the sender process exits
  // and closes its stdout, so we never see partial output.
  let pipedInput: string | null = null;
  if (!process.stdin.isTTY) {
    process.stderr.write('Reading piped input...\n');
    pipedInput = await drainPipedStdin();

    // Always reopen a real TTY — even if the pipe was empty, the original
    // stdin is consumed/closed and the TUI needs a live TTY for keyboard input.
    const reopenedStdin = reopenStdinFromTTY();
    if (!reopenedStdin) {
      rejectInitialPromptFlag('no TTY is available, so use --prompt for headless runs');
      process.stderr.write('No TTY available — falling back to headless mode.\n');
      return runMCCli(pipedInput, { coAuthor: TUI_CO_AUTHOR });
    }
  }

  const conflict = pipedInputConflict(initialPrompt, pipedInput);
  if (conflict) {
    process.stderr.write(`${conflict}\n`);
    process.exit(1);
  }

  return tuiMain(initialMessageOptions(initialPrompt, pipedInput), resumeThreadId, startupPackId);
}

main().catch(error => {
  handleFatalError(error);
});
