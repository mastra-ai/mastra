import { ExternalStreamingTranscriber } from './external-streaming.js';
import { MacOSSpeechTranscriber } from './macos-speech.js';
import type { StreamingTranscriber, StreamingTranscriberFactory } from './transcriber.js';
import type { VoiceInputState } from '../state.js';

export interface VoiceEditor {
  getText(): string;
  setText(text: string): void;
}

export interface VoiceManagerOptions {
  editor: VoiceEditor;
  setState: (state: VoiceInputState) => void;
  requestRender: () => void;
  canStart?: () => boolean;
  transcriberFactory?: StreamingTranscriberFactory;
  holdThresholdMs?: number;
  releaseDebounceMs?: number;
  repeatConfirmCount?: number;
}

const DEFAULT_HOLD_THRESHOLD_MS = 450;
const DEFAULT_RELEASE_DEBOUNCE_MS = 500;
const DEFAULT_REPEAT_CONFIRM_COUNT = 3;

export class VoiceManager {
  private status: VoiceInputState['status'] = 'idle';
  private armingTimer?: ReturnType<typeof setTimeout>;
  private releaseTimer?: ReturnType<typeof setTimeout>;
  private holdCount = 0;
  private baseText = '';
  private transcriber?: StreamingTranscriber;
  private sessionId = 0;

  constructor(private readonly options: VoiceManagerOptions) {}

  handleHoldSpace(): boolean {
    if (this.options.canStart && !this.options.canStart()) {
      return false;
    }

    if (this.status === 'recording' || this.status === 'transcribing') {
      this.holdCount += 1;
      this.resetReleaseTimer();
      return true;
    }

    if (this.status === 'arming') {
      this.holdCount += 1;
      this.resetReleaseTimer();
      return true;
    }

    if (this.status === 'error') {
      this.clearError();
    }

    this.status = 'arming';
    this.holdCount = 1;
    this.baseText = this.options.editor.getText();
    this.setVoiceState({ status: 'arming', baseText: this.baseText });
    this.armingTimer = setTimeout(() => {
      if (this.status !== 'arming') return;
      if (this.holdCount < this.repeatConfirmCount) {
        this.resetToIdle();
        return;
      }
      void this.startRecording();
    }, this.holdThresholdMs);
    this.resetReleaseTimer();
    return true;
  }

  async stop(): Promise<void> {
    this.clearTimers();
    const transcriber = this.transcriber;
    this.transcriber = undefined;
    this.sessionId += 1;
    if (transcriber) {
      await transcriber.stop();
    }
    this.resetToIdle();
  }

  getPromptState(): { active: boolean; glyph: string; color?: string } {
    if (this.status === 'error') {
      return { active: true, glyph: '!', color: '#ff5555' };
    }
    if (this.status === 'arming') {
      return { active: true, glyph: '◌' };
    }
    if (this.status === 'recording') {
      return { active: true, glyph: '●', color: '#ff5555' };
    }
    if (this.status === 'transcribing') {
      return { active: true, glyph: '◉' };
    }
    return { active: false, glyph: ' ' };
  }

  private async startRecording(): Promise<void> {
    if (this.status !== 'arming') return;

    const sessionId = ++this.sessionId;
    this.status = 'recording';
    this.transcriber = this.createTranscriber();
    this.setVoiceState({ status: 'recording', baseText: this.baseText });
    this.resetReleaseTimer();

    try {
      for await (const event of this.transcriber.start()) {
        if (sessionId !== this.sessionId) return;
        if (event.type === 'partial') {
          this.options.editor.setText(`${this.baseText}${event.text}`);
          this.setVoiceState({ status: this.status, baseText: this.baseText, partialText: event.text, level: event.level });
        } else if (event.type === 'final') {
          this.options.editor.setText(`${this.baseText}${event.text}`);
          this.setVoiceState({ status: 'transcribing', baseText: this.baseText, finalText: event.text });
        } else {
          this.showError(event.message);
          return;
        }
      }
    } catch (error) {
      if (sessionId === this.sessionId) {
        this.showError(error instanceof Error ? error.message : String(error));
      }
      return;
    }

    if (sessionId === this.sessionId) {
      this.resetToIdle();
    }
  }

  private createTranscriber(): StreamingTranscriber {
    if (this.options.transcriberFactory) {
      return this.options.transcriberFactory();
    }
    const command = process.env.MASTRACODE_VOICE_COMMAND;
    if (command) {
      return new ExternalStreamingTranscriber(command);
    }
    return new MacOSSpeechTranscriber();
  }

  private resetReleaseTimer(): void {
    if (this.releaseTimer) {
      clearTimeout(this.releaseTimer);
    }
    this.releaseTimer = setTimeout(() => {
      if (this.status === 'arming') {
        this.resetToIdle();
        return;
      }
      if (this.status === 'recording') {
        this.status = 'transcribing';
        this.setVoiceState({ status: 'transcribing', baseText: this.baseText, partialText: this.options.editor.getText().slice(this.baseText.length) });
        void this.transcriber?.stop();
      }
    }, this.releaseDebounceMs);
  }

  private showError(message: string): void {
    this.clearTimers();
    this.status = 'error';
    this.setVoiceState({ status: 'error', baseText: this.baseText, error: message });
    setTimeout(() => {
      if (this.status === 'error') {
        this.resetToIdle();
      }
    }, 2500);
  }

  private clearError(): void {
    if (this.status === 'error') {
      this.resetToIdle();
    }
  }

  private resetToIdle(): void {
    this.clearTimers();
    this.status = 'idle';
    this.holdCount = 0;
    this.setVoiceState({ status: 'idle' });
  }

  private clearTimers(): void {
    if (this.armingTimer) {
      clearTimeout(this.armingTimer);
      this.armingTimer = undefined;
    }
    if (this.releaseTimer) {
      clearTimeout(this.releaseTimer);
      this.releaseTimer = undefined;
    }
  }

  private setVoiceState(state: VoiceInputState): void {
    this.options.setState(state);
    this.options.requestRender();
  }

  private get holdThresholdMs(): number {
    return this.options.holdThresholdMs ?? DEFAULT_HOLD_THRESHOLD_MS;
  }

  private get releaseDebounceMs(): number {
    return this.options.releaseDebounceMs ?? DEFAULT_RELEASE_DEBOUNCE_MS;
  }

  private get repeatConfirmCount(): number {
    return this.options.repeatConfirmCount ?? DEFAULT_REPEAT_CONFIRM_COUNT;
  }
}
