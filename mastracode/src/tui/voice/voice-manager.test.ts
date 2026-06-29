import { describe, expect, it, vi } from 'vitest';

import type { StreamingTranscriber, TranscriptEvent } from './transcriber.js';
import { VoiceManager } from './voice-manager.js';

class TestTranscriber implements StreamingTranscriber {
  public stop = vi.fn();

  constructor(private readonly events: TranscriptEvent[]) {}

  async *start(): AsyncIterable<TranscriptEvent> {
    for (const event of this.events) {
      yield event;
    }
  }
}

class StopFinalizingTranscriber implements StreamingTranscriber {
  public stop = vi.fn(() => {
    this.resolveFinal?.({ type: 'final', text: 'hello world' });
  });
  private resolveFinal?: (event: TranscriptEvent) => void;

  async *start(): AsyncIterable<TranscriptEvent> {
    yield { type: 'partial', text: 'hello' };
    yield await new Promise<TranscriptEvent>(resolve => {
      this.resolveFinal = resolve;
    });
  }
}

describe('VoiceManager', () => {
  it('streams partial transcripts into the editor and leaves the final text editable', async () => {
    vi.useFakeTimers();
    const editor = {
      text: '',
      getText: vi.fn(() => editor.text),
      setText: vi.fn((text: string) => {
        editor.text = text;
      }),
    };
    const setState = vi.fn();
    const manager = new VoiceManager({
      editor,
      setState,
      requestRender: vi.fn(),
      transcriberFactory: () =>
        new TestTranscriber([
          { type: 'partial', text: 'hello' },
          { type: 'partial', text: 'hello world' },
          { type: 'final', text: 'hello world' },
        ]),
      holdThresholdMs: 1,
      releaseDebounceMs: 1_000,
      repeatConfirmCount: 1,
    });

    expect(manager.handleHoldSpace()).toBe(true);
    await vi.advanceTimersByTimeAsync(1);

    expect(editor.setText).toHaveBeenNthCalledWith(1, 'hello');
    expect(editor.setText).toHaveBeenNthCalledWith(2, 'hello world');
    expect(editor.setText).toHaveBeenNthCalledWith(3, 'hello world');
    expect(setState).toHaveBeenCalledWith({ status: 'idle' });
    vi.useRealTimers();
  });

  it('waits for a stop-induced final transcript before returning to idle', async () => {
    vi.useFakeTimers();
    const editor = {
      text: '',
      getText: vi.fn(() => editor.text),
      setText: vi.fn((text: string) => {
        editor.text = text;
      }),
    };
    const transcriber = new StopFinalizingTranscriber();
    const setState = vi.fn();
    const manager = new VoiceManager({
      editor,
      setState,
      requestRender: vi.fn(),
      transcriberFactory: () => transcriber,
      holdThresholdMs: 1,
      releaseDebounceMs: 10,
      repeatConfirmCount: 1,
    });

    manager.handleHoldSpace();
    await vi.advanceTimersByTimeAsync(1);
    expect(editor.setText).toHaveBeenLastCalledWith('hello');

    await vi.advanceTimersByTimeAsync(10);

    expect(transcriber.stop).toHaveBeenCalledOnce();
    expect(editor.setText).toHaveBeenLastCalledWith('hello world');
    expect(setState).toHaveBeenLastCalledWith({ status: 'idle' });
    vi.useRealTimers();
  });

  it('does not auto-submit or mutate non-voice text when finalizing', async () => {
    vi.useFakeTimers();
    const editor = {
      text: 'draft: ',
      getText: vi.fn(() => editor.text),
      setText: vi.fn((text: string) => {
        editor.text = text;
      }),
    };
    const manager = new VoiceManager({
      editor,
      setState: vi.fn(),
      requestRender: vi.fn(),
      transcriberFactory: () => new TestTranscriber([{ type: 'final', text: 'spoken' }]),
      holdThresholdMs: 1,
      releaseDebounceMs: 1_000,
      repeatConfirmCount: 1,
    });

    manager.handleHoldSpace();
    await vi.advanceTimersByTimeAsync(1);

    expect(editor.setText).toHaveBeenCalledWith('draft: spoken');
    vi.useRealTimers();
  });

  it('blocks activation when the caller says voice cannot start', () => {
    const editor = { getText: vi.fn(() => ''), setText: vi.fn() };
    const manager = new VoiceManager({
      editor,
      setState: vi.fn(),
      requestRender: vi.fn(),
      canStart: () => false,
      transcriberFactory: () => new TestTranscriber([]),
    });

    expect(manager.handleHoldSpace()).toBe(false);
    expect(editor.setText).not.toHaveBeenCalled();
  });
});
