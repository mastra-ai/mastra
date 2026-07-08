/**
 * Local microphone capture for push-to-talk voice input.
 *
 * Spawns an external recorder binary (sox/rec or ffmpeg) to capture audio
 * from the system microphone into a temporary WAV file. Audio is recorded as
 * 16kHz mono PCM, which is what speech-to-text models expect.
 *
 * The capture lifecycle is: detect a recorder once, start() spawns the process,
 * stop() signals the process to finish and resolves with the recorded buffer.
 */

import type { ChildProcess } from 'node:child_process';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type RecorderKind = 'sox' | 'ffmpeg' | 'pipewire' | 'pulse' | 'alsa';

export interface RecorderInfo {
  kind: RecorderKind;
  /** Resolved binary name used to spawn the recorder. */
  bin: string;
}

const SAMPLE_RATE = 16000;
const CHANNELS = 1;

/**
 * Detect an available recorder binary on the host (Linux/macOS).
 *
 * On Linux, prefer native recorders that ship with common desktop audio stacks
 * (PipeWire's `pw-record`, PulseAudio's `parecord`, ALSA's `arecord`) so most
 * users need no extra install. macOS has no reliable built-in CLI recorder, so
 * it falls back to sox/ffmpeg. Both also fall back to sox/ffmpeg if present.
 *
 * Returns null if nothing usable is installed.
 */
export function detectRecorder(): RecorderInfo | null {
  // Only macOS and Linux are supported; other platforms (e.g. Windows) have no
  // input backend wired up, so don't advertise a recorder we can't drive.
  if (process.platform !== 'darwin' && process.platform !== 'linux') {
    return null;
  }
  if (process.platform === 'linux') {
    if (commandExists('pw-record')) return { kind: 'pipewire', bin: 'pw-record' };
    if (commandExists('parecord')) return { kind: 'pulse', bin: 'parecord' };
    if (commandExists('arecord')) return { kind: 'alsa', bin: 'arecord' };
  }
  for (const bin of ['rec', 'sox']) {
    if (commandExists(bin)) {
      return { kind: 'sox', bin };
    }
  }
  // ffmpegInputArgs() only knows the macOS avfoundation backend, so only offer
  // ffmpeg there. Linux falls back to the dedicated recorders above.
  if (process.platform === 'darwin' && commandExists('ffmpeg')) {
    return { kind: 'ffmpeg', bin: 'ffmpeg' };
  }
  return null;
}

function commandExists(bin: string): boolean {
  try {
    const probe = process.platform === 'win32' ? 'where' : 'which';
    execFileSync(probe, [bin], { stdio: ['ignore', 'ignore', 'ignore'], timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * A single in-progress microphone recording.
 */
export class MicRecording {
  private proc: ChildProcess;
  private outputPath: string;
  private recorder: RecorderInfo;
  private stderr = '';
  private exited: Promise<void>;
  private resolveExited!: () => void;
  private stopped = false;

  constructor(recorder: RecorderInfo) {
    this.recorder = recorder;
    this.outputPath = join(tmpdir(), `mastra-voice-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);

    const { command, args } = buildRecorderCommand(recorder, this.outputPath);
    this.proc = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });

    this.exited = new Promise<void>(resolve => {
      this.resolveExited = resolve;
    });

    this.proc.stderr?.on('data', (chunk: Buffer) => {
      this.stderr += chunk.toString();
    });
    this.proc.on('error', () => {
      this.resolveExited();
    });
    this.proc.on('close', () => {
      this.resolveExited();
    });
  }

  /**
   * Stop recording and return the captured audio as a WAV buffer.
   * Returns null if recording failed or produced no audio.
   */
  async stop(): Promise<Buffer | null> {
    if (this.stopped) return null;
    this.stopped = true;

    // ffmpeg listens for `q` on stdin to finish cleanly and flush the file.
    // sox/rec respond to SIGINT/SIGTERM by finalizing the WAV header.
    if (this.recorder.kind === 'ffmpeg' && this.proc.stdin && !this.proc.stdin.destroyed) {
      try {
        this.proc.stdin.write('q');
        this.proc.stdin.end();
      } catch {
        this.proc.kill('SIGINT');
      }
    } else {
      this.proc.kill('SIGINT');
    }

    await this.exited;

    try {
      if (!existsSync(this.outputPath)) return null;
      const buffer = readFileSync(this.outputPath);
      // A bare WAV header is 44 bytes; anything at or below that is empty audio.
      if (buffer.length <= 44) return null;
      return buffer;
    } catch {
      return null;
    } finally {
      this.cleanup();
    }
  }

  /**
   * Read the audio captured so far, mid-recording, as a playable WAV buffer.
   *
   * The recorder is still appending to the file and has not finalized the WAV
   * header's size fields, so we read the current bytes and patch the RIFF/data
   * chunk sizes to match what's actually on disk. Returns null if there isn't
   * enough audio yet to transcribe.
   */
  snapshot(): Buffer | null {
    if (this.stopped) return null;
    try {
      if (!existsSync(this.outputPath)) return null;
      const buffer = readFileSync(this.outputPath);
      // Need a header plus a little audio to be worth transcribing.
      if (buffer.length <= 1024) return null;
      return fixWavHeader(buffer);
    } catch {
      return null;
    }
  }

  /**
   * Abort recording without returning audio (e.g. on cancel).
   */
  cancel(): void {
    if (this.stopped) return;
    this.stopped = true;
    try {
      this.proc.kill('SIGKILL');
    } catch {
      // ignore
    }
    this.cleanup();
  }

  private cleanup(): void {
    try {
      if (existsSync(this.outputPath)) unlinkSync(this.outputPath);
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Patch a WAV buffer's RIFF/data chunk sizes to match its actual byte length.
 *
 * Recorders write a placeholder (often zero or streaming) size while capture is
 * ongoing, so a mid-recording snapshot has wrong sizes. We rewrite the RIFF
 * chunk size (total file size minus 8) and the `data` chunk size (bytes after
 * the data header) so decoders read the audio we actually have.
 */
function fixWavHeader(buffer: Buffer): Buffer {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF') {
    return buffer;
  }
  const out = Buffer.from(buffer);
  // RIFF chunk size = total length - 8 (the "RIFF" tag and this size field).
  out.writeUInt32LE(out.length - 8, 4);

  // Locate the "data" sub-chunk; its size field is the 4 bytes that follow.
  const dataIdx = out.indexOf('data', 12, 'ascii');
  if (dataIdx !== -1 && dataIdx + 8 <= out.length) {
    const dataSize = out.length - (dataIdx + 8);
    out.writeUInt32LE(dataSize, dataIdx + 4);
  }
  return out;
}

function buildRecorderCommand(recorder: RecorderInfo, outputPath: string): { command: string; args: string[] } {
  switch (recorder.kind) {
    case 'pipewire':
      // PipeWire: record from the default source as 16kHz mono signed 16-bit WAV.
      return {
        command: recorder.bin,
        args: ['--rate', String(SAMPLE_RATE), '--channels', String(CHANNELS), '--format', 's16', outputPath],
      };
    case 'pulse':
      // PulseAudio's parecord writes a WAV when the path ends in .wav.
      return {
        command: recorder.bin,
        args: ['--rate', String(SAMPLE_RATE), '--channels', String(CHANNELS), '--format', 's16le', outputPath],
      };
    case 'alsa':
      // ALSA's arecord from the default device.
      return {
        command: recorder.bin,
        args: ['-q', '-f', 'S16_LE', '-c', String(CHANNELS), '-r', String(SAMPLE_RATE), '-t', 'wav', outputPath],
      };
    case 'sox': {
      // `rec` is sox's record front-end; when only `sox` exists, use `-d` for the
      // default input device. Output is 16kHz mono signed 16-bit WAV.
      const baseArgs = ['-q', '-c', String(CHANNELS), '-r', String(SAMPLE_RATE), '-b', '16', '-e', 'signed-integer'];
      if (recorder.bin === 'rec') {
        return { command: 'rec', args: [...baseArgs, outputPath] };
      }
      return { command: 'sox', args: ['-d', ...baseArgs, outputPath] };
    }
    case 'ffmpeg':
    default: {
      const input = ffmpegInputArgs();
      return {
        command: 'ffmpeg',
        args: [
          '-hide_banner',
          '-loglevel',
          'error',
          ...input,
          '-ac',
          String(CHANNELS),
          '-ar',
          String(SAMPLE_RATE),
          '-y',
          outputPath,
        ],
      };
    }
  }
}

function ffmpegInputArgs(): string[] {
  switch (process.platform) {
    case 'darwin':
      // Capture from the default audio input device, no video.
      return ['-f', 'avfoundation', '-i', ':default'];
    case 'linux':
    default:
      // Prefer PulseAudio's default source; ALSA's `default` is the fallback.
      return ['-f', 'pulse', '-i', 'default'];
  }
}
