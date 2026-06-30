/**
 * macOS native STT engine.
 *
 * Launches the bundled on-device `SFSpeechRecognizer` `.app` (built and cached by
 * `native/compile.ts`) through LaunchServices (`open`) — the only launch path
 * that makes macOS show the Speech Recognition / Microphone permission prompts.
 * Because a LaunchServices-launched app has no usable stdin/stdout pipe back to
 * the parent, IPC is file-based: the recognizer appends newline-delimited JSON
 * events to an `events.jsonl` file we tail, and we ask it to stop by creating a
 * `stop` sentinel file it polls for. Partial hypotheses arrive in true realtime
 * with no network and no per-utterance cost; the final result is emitted on stop.
 *
 * `stop()` writes the stop sentinel so the recognizer flushes a final result,
 * then resolves once that final event arrives. `cancel()` tears it down.
 */

import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveRecognizer } from '../native/compile.js';
import type { PermissionGuidance, STTEngine, STTSession, STTSessionCallbacks } from './types.js';

/** Deep links to the exact macOS Privacy & Security panes. */
const MIC_SETTINGS_URL = 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone';
const SPEECH_SETTINGS_URL = 'x-apple.systempreferences:com.apple.preference.security?Privacy_SpeechRecognition';

/**
 * How long to wait after closing stdin for the recognizer to flush its final
 * result before falling back to SIGTERM. The Swift side gives itself up to ~1.5s
 * to emit a final, so this is set a little above that.
 */
const FINAL_FLUSH_GRACE_MS = 2000;

interface RecognizerEvent {
  type: 'ready' | 'partial' | 'final' | 'error';
  text?: string;
  message?: string;
}

type TccStatus = 'authorized' | 'denied' | 'restricted' | 'notDetermined' | 'unknown';

interface ProbeResult {
  speech: TccStatus;
  mic: TccStatus;
  available: boolean;
}

/**
 * Run the recognizer in `--probe` mode to read Speech Recognition + Microphone
 * authorization status without recording. Returns null if the probe can't run
 * (e.g. swiftc missing) — the caller handles that separately.
 *
 * The probe is launched through the same `.app` bundle via LaunchServices that
 * the recording path uses. macOS attributes TCC grants to the bundle identity
 * (`ai.mastra.mastracode.voice`), so running the loose binary directly would
 * query a *different* TCC identity (the terminal's) and wrongly report
 * `notDetermined`/`denied` even after the user granted access to the bundle.
 * Because LaunchServices apps have no usable stdout pipe, the probe writes its
 * result to an events file (shared file-IPC) that we read back.
 */
async function probePermissions(): Promise<ProbeResult | null> {
  const invocation = await resolveRecognizer();
  if (!invocation) return null;

  let workDir: string;
  try {
    workDir = await mkdtemp(join(tmpdir(), 'mastracode-voice-probe-'));
  } catch {
    return null;
  }
  const eventPath = join(workDir, 'probe.jsonl');
  try {
    await writeFile(eventPath, '', 'utf8');
  } catch {
    // Non-fatal: the probe creates it on first emit.
  }

  const cleanup = () => {
    void rm(workDir, { recursive: true, force: true }).catch(() => {});
  };

  return new Promise<ProbeResult | null>(resolve => {
    let settled = false;
    const done = (result: ProbeResult | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    let child: ReturnType<typeof spawn>;
    try {
      // Launch via LaunchServices so the probe runs under the granted bundle
      // identity. `-g` keeps it from stealing focus; `-W` waits for exit.
      child = spawn('open', ['-n', '-W', '-g', invocation.appPath, '--args', '--probe', '--events', eventPath], {
        stdio: ['ignore', 'ignore', 'ignore'],
      });
    } catch {
      done(null);
      return;
    }

    const readProbe = async (): Promise<ProbeResult | null> => {
      let out = '';
      try {
        out = await readFile(eventPath, 'utf8');
      } catch {
        return null;
      }
      const line = out.split('\n').find(l => l.includes('"type":"probe"') || l.includes('"type": "probe"'));
      if (!line) return null;
      try {
        const parsed = JSON.parse(line) as { speech?: TccStatus; mic?: TccStatus; available?: boolean };
        return {
          speech: parsed.speech ?? 'unknown',
          mic: parsed.mic ?? 'unknown',
          available: parsed.available ?? false,
        };
      } catch {
        return null;
      }
    };

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      void readProbe().then(done);
    }, 5000);

    child.on('error', () => {
      clearTimeout(timer);
      done(null);
    });
    child.on('exit', () => {
      clearTimeout(timer);
      void readProbe().then(done);
    });
  });
}

/** Turn a probe result into a user-facing problem message, or null if ready. */
function describeProbe(probe: ProbeResult): string | null {
  const settingsHint = 'System Settings › Privacy & Security';
  if (probe.mic === 'denied' || probe.mic === 'restricted') {
    return `Microphone access is blocked. Enable MastraCode Voice under ${settingsHint} › Microphone, then restart your terminal.`;
  }
  if (probe.speech === 'denied' || probe.speech === 'restricted') {
    return `Speech Recognition access is blocked. Enable MastraCode Voice under ${settingsHint} › Speech Recognition, then restart your terminal.`;
  }
  if (probe.mic === 'notDetermined' || probe.speech === 'notDetermined') {
    return 'Microphone / Speech Recognition access not granted yet — the first time you hold space to dictate, macOS will prompt; click Allow on both.';
  }
  if (!probe.available) {
    return 'On-device speech recognition is not available for your locale.';
  }
  return null;
}

/** Turn a probe result into structured, actionable permission guidance. */
function guidanceFromProbe(probe: ProbeResult): PermissionGuidance {
  const blockedMic = probe.mic === 'denied' || probe.mic === 'restricted';
  const blockedSpeech = probe.speech === 'denied' || probe.speech === 'restricted';

  if (blockedMic || blockedSpeech) {
    const which = blockedMic ? 'Microphone' : 'Speech Recognition';
    return {
      state: 'blocked',
      summary: `${which} access is turned off for MastraCode Voice, so on-device dictation can't run.`,
      steps: [
        `Open System Settings › Privacy & Security › ${which}.`,
        'Turn on the switch next to MastraCode Voice.',
        'Fully quit and reopen the terminal so the change takes effect.',
      ],
      settingsUrl: blockedMic ? MIC_SETTINGS_URL : SPEECH_SETTINGS_URL,
      actionLabel: `Open ${which} settings`,
    };
  }

  if (probe.mic === 'notDetermined' || probe.speech === 'notDetermined') {
    return {
      state: 'will-prompt',
      summary: "macOS hasn't asked for access yet — it will prompt the first time you dictate.",
      steps: [
        'Hold the space bar and start speaking.',
        'When macOS asks, click Allow for both Microphone and Speech Recognition.',
      ],
    };
  }

  if (!probe.available) {
    return {
      state: 'unsupported',
      summary: 'On-device speech recognition is not available for your locale. Switch to a cloud provider with /voice.',
    };
  }

  return { state: 'ok', summary: 'Microphone and Speech Recognition access are granted.' };
}

/** How often to poll the event file for newly appended JSON lines. */
const EVENT_POLL_INTERVAL_MS = 80;

class MacosNativeSession implements STTSession {
  private openChild: ReturnType<typeof spawn> | null = null;
  private workDir: string | null = null;
  private eventPath = '';
  private stopPath = '';
  private readOffset = 0;
  private pendingLine = '';
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private polling = false;
  private sawEvent = false;
  private cancelled = false;
  private finalResolve: (() => void) | null = null;
  private finalPromise: Promise<void>;
  private settled = false;

  constructor(private readonly callbacks: STTSessionCallbacks) {
    this.finalPromise = new Promise(resolve => {
      this.finalResolve = resolve;
    });
    void this.launch();
  }

  private async launch(): Promise<void> {
    const invocation = await resolveRecognizer();
    if (!invocation) {
      this.fail(new Error('Swift toolchain not found. Install Xcode command line tools (`xcode-select --install`).'));
      return;
    }

    try {
      this.workDir = await mkdtemp(join(tmpdir(), 'mastracode-voice-'));
    } catch (err) {
      this.fail(err instanceof Error ? err : new Error('Could not create a temp dir for the macOS recognizer.'));
      return;
    }
    this.eventPath = join(this.workDir, 'events.jsonl');
    this.stopPath = join(this.workDir, 'stop');
    // Pre-create the event file so the first poll has something to read.
    try {
      await writeFile(this.eventPath, '', 'utf8');
    } catch {
      // Non-fatal: the recognizer creates it on first emit.
    }

    // Launch the .app via LaunchServices. `open` is the only path that makes
    // macOS present the Speech Recognition / Microphone permission prompts.
    //   -n  always start a new instance
    //   -W  wait until the app exits (so the child exit tells us it's done)
    //   -g  do not bring the app to the foreground / steal focus
    // Args after `--args` are forwarded to the app's executable.
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(
        'open',
        ['-n', '-W', '-g', invocation.appPath, '--args', '--events', this.eventPath, '--stop', this.stopPath],
        { stdio: ['ignore', 'ignore', 'pipe'] },
      );
    } catch (err) {
      this.fail(err instanceof Error ? err : new Error('Could not launch the macOS recognizer.'));
      return;
    }
    this.openChild = child;
    let stderr = '';
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', err => this.fail(err instanceof Error ? err : new Error(String(err))));
    child.on('exit', (code, signal) => this.onOpenExit(code, signal, stderr));

    this.startPolling();
  }

  private startPolling(): void {
    this.pollTimer = setInterval(() => {
      void this.poll();
    }, EVENT_POLL_INTERVAL_MS);
  }

  private async poll(flush = false): Promise<void> {
    if (this.settled || this.polling) return;
    this.polling = true;
    try {
      const contents = await readFile(this.eventPath, 'utf8');
      if (contents.length > this.readOffset) {
        const fresh = contents.slice(this.readOffset);
        this.readOffset = contents.length;
        // The recognizer may be mid-write, leaving a trailing partial line.
        // Buffer it and only dispatch complete (newline-terminated) lines.
        const lines = (this.pendingLine + fresh).split('\n');
        this.pendingLine = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) this.handleLine(trimmed);
        }
      }
      // On a final drain the recognizer has exited, so any buffered remainder
      // is a complete line that simply lacked a trailing newline — flush it.
      if (flush && this.pendingLine.trim()) {
        const trimmed = this.pendingLine.trim();
        this.pendingLine = '';
        this.handleLine(trimmed);
      }
    } catch {
      // File may not exist yet between launch and first emit; ignore.
    } finally {
      this.polling = false;
    }
  }

  /**
   * If `open` exits before the recognizer ever emitted a JSON event, the app
   * crashed before recording could start — almost always a denied/suppressed
   * macOS permission prompt or a TCC kill. Surface a clear, actionable error
   * instead of settling silently.
   */
  private onOpenExit(code: number | null, signal: NodeJS.Signals | null, stderr: string): void {
    // Drain any events the recognizer wrote just before exiting, flushing a
    // final line that may lack a trailing newline.
    void this.poll(true).then(() => {
      if (this.settled) return;
      if (!this.sawEvent) {
        const detail = stderr.trim();
        const reason = detail
          ? detail.split('\n').slice(-1)[0]
          : signal
            ? `terminated (${signal})`
            : `exited with code ${code ?? 'unknown'}`;
        this.fail(
          new Error(
            `macOS speech recognition stopped before it could start (${reason}). ` +
              `If macOS didn't prompt you, enable MastraCode Voice under System Settings › Privacy & Security › ` +
              `Microphone and Speech Recognition, then fully quit and reopen the terminal.`,
          ),
        );
        return;
      }
      this.settle();
    });
  }

  private handleLine(line: string): void {
    let event: RecognizerEvent;
    try {
      event = JSON.parse(line) as RecognizerEvent;
    } catch {
      return;
    }
    this.sawEvent = true;
    // Once cancelled we only let the recognizer wind down; no transcripts surface.
    if (this.cancelled) {
      if (event.type === 'final' || event.type === 'error') this.settle();
      return;
    }
    switch (event.type) {
      case 'partial':
        if (event.text) this.callbacks.onPartial(event.text);
        break;
      case 'final':
        this.callbacks.onFinal(event.text ?? '');
        this.settle();
        break;
      case 'error':
        this.fail(new Error(event.message ?? 'macOS speech recognition failed.'));
        break;
      case 'ready':
      default:
        break;
    }
  }

  private fail(error: Error): void {
    if (this.settled) return;
    this.callbacks.onError(error);
    this.teardown();
    this.settle();
  }

  private settle(): void {
    if (this.settled) return;
    this.settled = true;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.finalResolve?.();
    void this.cleanupWorkDir();
  }

  private teardown(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.openChild) {
      this.openChild.kill('SIGKILL');
      this.openChild = null;
    }
  }

  /**
   * Stop recording without emitting a transcript, but let the recognizer wind
   * down gracefully so it releases the microphone. We write the stop sentinel
   * and wait for the LaunchServices app to observe it and exit on its own (its
   * `exit` handler settles us and removes the temp dir). A SIGKILL + forced
   * cleanup is only a safety net if the app never acknowledges the sentinel —
   * tearing the temp dir down immediately would delete the stop file before the
   * detached app could poll it, leaving the mic live with no control channel.
   */
  private async gracefulCancel(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    await this.signalStop();
    if (this.settled || !this.openChild) {
      this.settle();
      return;
    }
    const safetyNet = setTimeout(() => {
      this.teardown();
      this.settle();
    }, FINAL_FLUSH_GRACE_MS);
    void this.finalPromise.finally(() => clearTimeout(safetyNet));
  }

  private async cleanupWorkDir(): Promise<void> {
    const dir = this.workDir;
    this.workDir = null;
    if (!dir) return;
    try {
      await rm(dir, { recursive: true, force: true });
    } catch {
      // Best effort.
    }
  }

  /** Signal the recognizer to flush a final result, then wait for it. */
  private async signalStop(): Promise<void> {
    if (this.stopPath) {
      try {
        await writeFile(this.stopPath, '', 'utf8');
      } catch {
        // If we can't write the sentinel, fall back to killing the app.
        this.openChild?.kill('SIGTERM');
      }
    }
  }

  async stop(): Promise<void> {
    if (!this.settled) {
      await this.signalStop();
      // The recognizer needs a moment after seeing the stop file to run its
      // final recognition pass and append the `final` event. The poll loop will
      // pick it up and settle. A delayed kill is only a safety net.
      const safetyNet = setTimeout(() => {
        if (!this.settled) {
          this.openChild?.kill('SIGTERM');
        }
      }, FINAL_FLUSH_GRACE_MS);
      void this.finalPromise.finally(() => clearTimeout(safetyNet));
    }
    await this.finalPromise;
  }

  cancel(): void {
    if (this.settled || this.cancelled) return;
    this.cancelled = true;
    void this.gracefulCancel();
  }
}

export class MacosNativeSTTEngine implements STTEngine {
  readonly kind = 'macos-native' as const;

  checkReady(): string | null {
    if (process.platform !== 'darwin') {
      return 'macOS native speech recognition is only available on macOS. Choose a cloud provider with /voice.';
    }
    return null;
  }

  /**
   * Deeper preflight: confirm the Swift toolchain compiles the recognizer, then
   * probe the actual Speech Recognition + Microphone TCC authorization status so
   * /voice status can tell the user exactly which permission to enable instead of
   * letting it fail silently mid-dictation.
   */
  async verify(): Promise<string | null> {
    const platform = this.checkReady();
    if (platform) return platform;
    const invocation = await resolveRecognizer();
    if (!invocation) {
      return 'macOS native STT needs the Swift toolchain. Install Xcode command line tools (`xcode-select --install`), then run /voice again.';
    }
    const probe = await probePermissions();
    if (probe) {
      const problem = describeProbe(probe);
      if (problem) return problem;
    }
    return null;
  }

  /**
   * Structured permission guidance for the TUI. Confirms the toolchain compiles,
   * then probes the real TCC state and returns actionable steps (and a Settings
   * deep link) so the UI can walk the user through granting access.
   */
  async permissions(): Promise<PermissionGuidance> {
    if (process.platform !== 'darwin') {
      return {
        state: 'unsupported',
        summary: 'macOS native speech recognition is only available on macOS. Choose a cloud provider with /voice.',
      };
    }
    const invocation = await resolveRecognizer();
    if (!invocation) {
      return {
        state: 'unsupported',
        summary: 'On-device dictation needs the Swift toolchain.',
        steps: ['Run `xcode-select --install` to install the Xcode command line tools.', 'Then run /voice again.'],
      };
    }
    const probe = await probePermissions();
    if (!probe) {
      // Probe couldn't run; assume macOS will prompt on first dictation.
      return {
        state: 'will-prompt',
        summary: "Couldn't read permission state — macOS will prompt the first time you dictate.",
        steps: ['Hold the space bar and start speaking.', 'Click Allow when macOS asks for access.'],
      };
    }
    return guidanceFromProbe(probe);
  }

  start(callbacks: STTSessionCallbacks): STTSession {
    return new MacosNativeSession(callbacks);
  }
}
