import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  superHandleInput: vi.fn(),
  superRender: vi.fn(() => ['────', 'hello', '────']),
  editorSetText: vi.fn(),
  getClipboardImage: vi.fn(),
  getClipboardText: vi.fn(),
  matchesKey: vi.fn((_data: string, _key: string) => false),
  readFileSync: vi.fn(),
  statSync: vi.fn(),
  chalkHex: vi.fn((_color: string) => (value: string) => value),
  chalkBoldHex: vi.fn((_color: string) => (value: string) => `[hex:${_color}]${value}`),
  chalkBoldRgb: vi.fn((r: number, g: number, b: number) => (value: string) => `[rgb:${r},${g},${b}]${value}`),
}));

vi.mock('node:fs', () => ({
  readFileSync: mocks.readFileSync,
  statSync: mocks.statSync,
}));

vi.mock('@earendil-works/pi-tui', () => {
  class MockEditor {
    protected tui: unknown;
    constructor(_tui: unknown, _theme: unknown) {
      this.tui = _tui;
    }

    handleInput(data: string): void {
      mocks.superHandleInput(data);
    }

    render(_width: number): string[] {
      return mocks.superRender();
    }

    getText(): string {
      return '';
    }

    setText(text: string): void {
      mocks.editorSetText(text);
    }

    isShowingAutocomplete(): boolean {
      return false;
    }
  }

  return {
    Editor: MockEditor,
    matchesKey: mocks.matchesKey,
  };
});

vi.mock('../../../clipboard/index.js', () => ({
  getClipboardImage: mocks.getClipboardImage,
  getClipboardText: mocks.getClipboardText,
}));

vi.mock('chalk', () => ({
  default: {
    hex: mocks.chalkHex,
    bold: {
      hex: mocks.chalkBoldHex,
      rgb: mocks.chalkBoldRgb,
    },
  },
}));

import { CustomEditor } from '../custom-editor.js';

const PASTE_START = '\x1b[200~';
const PASTE_END = '\x1b[201~';

describe('CustomEditor image paste handling', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
    mocks.superRender.mockReturnValue(['────', 'hello', '────']);
    mocks.chalkHex.mockImplementation((_color: string) => (value: string) => value);
    mocks.chalkBoldHex.mockImplementation((color: string) => (value: string) => `[hex:${color}]${value}`);
    mocks.chalkBoldRgb.mockImplementation(
      (r: number, g: number, b: number) => (value: string) => `[rgb:${r},${g},${b}]${value}`,
    );
    mocks.matchesKey.mockImplementation((_data: string, _key: string) => false);
    mocks.statSync.mockReturnValue({ isFile: () => true });
    mocks.readFileSync.mockReturnValue(Buffer.from('dragged-image-binary'));
  });

  it('highlights the first visible slash-command match when autocomplete opens', () => {
    const editor = new CustomEditor({} as any, {} as any);

    const items = [{ value: 'new' }, { value: 'diff' }, { value: '/deploy' }];

    expect((editor as any).getBestAutocompleteMatchIndex(items, '/')).toBe(0);
    expect((editor as any).getBestAutocompleteMatchIndex(items, '/d')).toBe(1);
  });

  it('submits a selected slash command on Enter after autocomplete inserts it', () => {
    mocks.matchesKey.mockImplementation((_data: string, key: string) => key === 'enter');

    const editor = new CustomEditor({} as any, {} as any);
    const followUp = vi.fn(() => true);
    editor.onAction('followUp', followUp);
    editor.getText = vi.fn(() => '/help ');
    editor.isShowingAutocomplete = vi.fn(() => true);

    editor.handleInput('\r');

    expect(mocks.superHandleInput).toHaveBeenCalledWith('\t');
    expect(followUp).toHaveBeenCalledTimes(1);
  });

  it('preserves the slash before submitting a slash autocomplete selection that inserts without one', () => {
    mocks.matchesKey.mockImplementation((_data: string, key: string) => key === 'enter');

    const editor = new CustomEditor({} as any, {} as any);
    const followUp = vi.fn(() => true);
    editor.onAction('followUp', followUp);
    editor.getText = vi.fn().mockReturnValueOnce('/goal/pr').mockReturnValue('goal/pr-triage ');
    editor.isShowingAutocomplete = vi.fn(() => true);

    editor.handleInput('\r');

    expect(mocks.superHandleInput).toHaveBeenCalledWith('\t');
    expect(mocks.editorSetText).toHaveBeenCalledWith('/goal/pr-triage ');
    expect(followUp).toHaveBeenCalledTimes(1);
  });

  it('does not submit non-slash autocomplete selections on Enter', () => {
    mocks.matchesKey.mockImplementation((_data: string, key: string) => key === 'enter');

    const editor = new CustomEditor({} as any, {} as any);
    const followUp = vi.fn(() => true);
    editor.onAction('followUp', followUp);
    editor.getText = vi.fn(() => '@package/file.ts');
    editor.isShowingAutocomplete = vi.fn(() => true);

    editor.handleInput('\r');

    expect(mocks.superHandleInput).toHaveBeenCalledWith('\t');
    expect(followUp).not.toHaveBeenCalled();
  });

  it('queues a follow-up on Ctrl+F', () => {
    mocks.matchesKey.mockImplementation((_data: string, key: string) => key === 'ctrl+f');

    const editor = new CustomEditor({} as any, {} as any);
    const queueFollowUp = vi.fn(() => true);
    editor.onAction('queueFollowUp', queueFollowUp);

    editor.handleInput('\x06');

    expect(queueFollowUp).toHaveBeenCalledTimes(1);
    expect(mocks.superHandleInput).not.toHaveBeenCalled();
  });

  it('resolves slash autocomplete before queueing a follow-up on Ctrl+F', () => {
    mocks.matchesKey.mockImplementation((_data: string, key: string) => key === 'ctrl+f');

    const editor = new CustomEditor({} as any, {} as any);
    const queueFollowUp = vi.fn(() => true);
    editor.onAction('queueFollowUp', queueFollowUp);
    editor.getText = vi.fn().mockReturnValueOnce('/rev').mockReturnValue('review ');
    editor.isShowingAutocomplete = vi.fn(() => true);

    editor.handleInput('\x06');

    expect(mocks.superHandleInput).toHaveBeenCalledWith('\t');
    expect(mocks.editorSetText).toHaveBeenCalledWith('/review ');
    expect(queueFollowUp).toHaveBeenCalledTimes(1);
  });

  it('routes Ctrl+Z to suspend and Alt+Z to undo without falling through to the base editor', () => {
    mocks.matchesKey.mockImplementation(
      (data: string, key: string) => (data === '\x1a' && key === 'ctrl+z') || (data === '\u001bz' && key === 'alt+z'),
    );

    const editor = new CustomEditor({} as any, {} as any);
    const suspend = vi.fn();
    const undo = vi.fn();
    editor.onAction('suspend', suspend);
    editor.onAction('undo', undo);

    editor.handleInput('\x1a');
    expect(suspend).toHaveBeenCalledTimes(1);
    expect(undo).not.toHaveBeenCalled();

    mocks.matchesKey.mockImplementation((_data: string, key: string) => key === 'alt+z');
    editor.handleInput('\u001bz');

    expect(undo).toHaveBeenCalledTimes(1);
    expect(mocks.superHandleInput).not.toHaveBeenCalled();
  });

  it('renders a chevron prompt when no animator is active', () => {
    const editor = new CustomEditor({} as any, {} as any);
    editor.getText = vi.fn(() => 'hello');
    editor.getModeColor = vi.fn(() => '#16c858');

    const output = editor.render(20).join('\n');

    expect(output).toContain('[rgb:22,200,88]›');
  });

  it('fades the chevron out, fades the pulsing bullet in, then fades back to the chevron on exit', () => {
    const editor = new CustomEditor({} as any, {} as any);
    editor.getText = vi.fn(() => 'hello');
    editor.getModeColor = vi.fn(() => '#16c858');

    editor.getPromptAnimator = vi.fn(
      () =>
        ({
          isRunning: () => true,
          isFadingIn: () => true,
          isFadingOut: () => false,
          getFadeProgress: () => 0.8,
          getOffset: () => 0,
        }) as any,
    );
    expect(editor.render(20).join('\n')).toContain('[rgb:13,120,53]›');

    editor.getPromptAnimator = vi.fn(
      () =>
        ({
          isRunning: () => true,
          isFadingIn: () => true,
          isFadingOut: () => false,
          getFadeProgress: () => 0.5,
          getOffset: () => 0,
        }) as any,
    );
    const invisibleOutput = editor.render(20).join('\n');
    expect(invisibleOutput).not.toContain('›');
    expect(invisibleOutput).not.toContain('•');

    editor.getPromptAnimator = vi.fn(
      () =>
        ({
          isRunning: () => true,
          isFadingIn: () => true,
          isFadingOut: () => false,
          getFadeProgress: () => 0.2,
          getOffset: () => 0,
        }) as any,
    );
    const transitionedOutput = editor.render(20).join('\n');
    expect(transitionedOutput).toContain('[rgb:13,120,53]•');
    expect(transitionedOutput).not.toContain('›');

    editor.getPromptAnimator = vi.fn(
      () =>
        ({
          isRunning: () => true,
          isFadingIn: () => false,
          isFadingOut: () => false,
          getFadeProgress: () => 0,
          getOffset: () => 0.5,
        }) as any,
    );
    const pulsingOutput = editor.render(20).join('\n');
    expect(pulsingOutput).toContain('[rgb:11,100,44]•');
    expect(pulsingOutput).not.toContain('›');

    editor.getPromptAnimator = vi.fn(
      () =>
        ({
          isRunning: () => true,
          isFadingIn: () => false,
          isFadingOut: () => true,
          getFadeProgress: () => 0.2,
          getOffset: () => 0,
        }) as any,
    );
    const fadingOutDotOutput = editor.render(20).join('\n');
    expect(fadingOutDotOutput).toContain('[rgb:13,120,53]•');
    expect(fadingOutDotOutput).not.toContain('›');

    editor.getPromptAnimator = vi.fn(
      () =>
        ({
          isRunning: () => true,
          isFadingIn: () => false,
          isFadingOut: () => true,
          getFadeProgress: () => 0.5,
          getOffset: () => 0,
        }) as any,
    );
    const fadingOutGapOutput = editor.render(20).join('\n');
    expect(fadingOutGapOutput).not.toContain('›');
    expect(fadingOutGapOutput).not.toContain('•');

    editor.getPromptAnimator = vi.fn(
      () =>
        ({
          isRunning: () => true,
          isFadingIn: () => false,
          isFadingOut: () => true,
          getFadeProgress: () => 0.8,
          getOffset: () => 0,
        }) as any,
    );
    const returnedChevronOutput = editor.render(20).join('\n');
    expect(returnedChevronOutput).toContain('[rgb:13,120,53]›');
    expect(returnedChevronOutput).not.toContain('•');
  });

  it('keeps slash prompts unanimated while showing the slash character', () => {
    const editor = new CustomEditor({} as any, {} as any);
    editor.getText = vi.fn(() => '/help');
    editor.getModeColor = vi.fn(() => '#16c858');
    editor.getPromptAnimator = vi.fn(
      () =>
        ({
          isRunning: () => true,
          getOffset: () => 0.75,
        }) as any,
    );

    const output = editor.render(20).join('\n');

    expect(output).toContain('[rgb:22,200,88]/');
  });

  it('converts a pasted local image path into an image attachment', () => {
    mocks.getClipboardImage.mockReturnValue({ data: 'clipboard-image', mimeType: 'image/png' });

    const editor = new CustomEditor({} as any, {} as any);
    const onImagePaste = vi.fn();
    editor.onImagePaste = onImagePaste;

    editor.handleInput(`${PASTE_START}/tmp/dragged-image.jpeg${PASTE_END}`);

    expect(onImagePaste).toHaveBeenCalledWith({
      data: Buffer.from('dragged-image-binary').toString('base64'),
      mimeType: 'image/jpeg',
    });
    expect(mocks.getClipboardImage).not.toHaveBeenCalled();
    expect(mocks.statSync).toHaveBeenCalledWith('/tmp/dragged-image.jpeg');
    expect(mocks.readFileSync).toHaveBeenCalledWith('/tmp/dragged-image.jpeg');
    expect(mocks.superHandleInput).not.toHaveBeenCalled();
  });

  it('supports quoted file urls for pasted local images', () => {
    const editor = new CustomEditor({} as any, {} as any);
    const onImagePaste = vi.fn();
    editor.onImagePaste = onImagePaste;

    editor.handleInput(`${PASTE_START}"file:///tmp/dragged%20image.png"${PASTE_END}`);

    expect(onImagePaste).toHaveBeenCalledWith({
      data: Buffer.from('dragged-image-binary').toString('base64'),
      mimeType: 'image/png',
    });
    expect(mocks.statSync).toHaveBeenCalledWith('/tmp/dragged image.png');
    expect(mocks.readFileSync).toHaveBeenCalledWith('/tmp/dragged image.png');
    expect(mocks.superHandleInput).not.toHaveBeenCalled();
  });

  it('prefers clipboard image data when a pasted remote image url came from copy-image', () => {
    const pastedImage = { data: 'clipboard-image', mimeType: 'image/png' };
    mocks.getClipboardImage.mockReturnValue(pastedImage);

    const editor = new CustomEditor({} as any, {} as any);
    const onImagePaste = vi.fn();
    editor.onImagePaste = onImagePaste;

    editor.handleInput(`${PASTE_START}https://example.com/dragged-image.webp?size=large${PASTE_END}`);

    expect(onImagePaste).toHaveBeenCalledWith(pastedImage);
    expect(mocks.getClipboardImage).toHaveBeenCalledTimes(1);
    expect(mocks.statSync).not.toHaveBeenCalled();
    expect(mocks.readFileSync).not.toHaveBeenCalled();
    expect(mocks.superHandleInput).not.toHaveBeenCalled();
  });

  it('falls back to a remote image attachment when clipboard image data is unavailable', () => {
    const editor = new CustomEditor({} as any, {} as any);
    const onImagePaste = vi.fn();
    editor.onImagePaste = onImagePaste;

    editor.handleInput(`${PASTE_START}https://example.com/dragged-image.webp?size=large${PASTE_END}`);

    expect(onImagePaste).toHaveBeenCalledWith({
      data: 'https://example.com/dragged-image.webp?size=large',
      mimeType: 'image/webp',
    });
    expect(mocks.getClipboardImage).toHaveBeenCalledTimes(1);
    expect(mocks.statSync).not.toHaveBeenCalled();
    expect(mocks.readFileSync).not.toHaveBeenCalled();
    expect(mocks.superHandleInput).not.toHaveBeenCalled();
  });

  it('passes through non-image file paths as text', () => {
    mocks.getClipboardImage.mockReturnValue({ data: 'clipboard-image', mimeType: 'image/png' });

    const editor = new CustomEditor({} as any, {} as any);
    const onImagePaste = vi.fn();
    editor.onImagePaste = onImagePaste;

    const pastedPath = '/tmp/notes.txt';
    editor.handleInput(`${PASTE_START}${pastedPath}${PASTE_END}`);

    expect(onImagePaste).not.toHaveBeenCalled();
    expect(mocks.getClipboardImage).not.toHaveBeenCalled();
    expect(mocks.superHandleInput).toHaveBeenCalledWith(`${PASTE_START}${pastedPath}${PASTE_END}`);
  });

  it('still uses the clipboard image for empty bracketed paste payloads', () => {
    const pastedImage = { data: 'clipboard-image', mimeType: 'image/png' };
    mocks.getClipboardImage.mockReturnValue(pastedImage);

    const editor = new CustomEditor({} as any, {} as any);
    const onImagePaste = vi.fn();
    editor.onImagePaste = onImagePaste;

    editor.handleInput(`${PASTE_START}${PASTE_END}`);

    expect(onImagePaste).toHaveBeenCalledWith(pastedImage);
    expect(mocks.superHandleInput).not.toHaveBeenCalled();
  });

  it('wraps Ctrl+V clipboard text in bracketed-paste markers before passing it to the editor', () => {
    mocks.matchesKey.mockImplementation((_data: string, key: string) => key === 'ctrl+v');
    mocks.getClipboardText.mockReturnValue('pasted text\nsecond line');

    const editor = new CustomEditor({} as any, {} as any);
    const onImagePaste = vi.fn();
    editor.onImagePaste = onImagePaste;

    editor.handleInput('ignored');

    expect(mocks.getClipboardImage).toHaveBeenCalledTimes(1);
    expect(mocks.getClipboardText).toHaveBeenCalledTimes(1);
    expect(onImagePaste).not.toHaveBeenCalled();
    expect(mocks.superHandleInput).toHaveBeenCalledWith(`${PASTE_START}pasted text\nsecond line${PASTE_END}`);
  });

  it('supports alt+v as an explicit clipboard paste shortcut', () => {
    mocks.matchesKey.mockImplementation((_data: string, key: string) => key === 'alt+v');
    const pastedImage = { data: 'clipboard-image', mimeType: 'image/png' };
    mocks.getClipboardImage.mockReturnValue(pastedImage);

    const editor = new CustomEditor({} as any, {} as any);
    const onImagePaste = vi.fn();
    editor.onImagePaste = onImagePaste;

    editor.handleInput('ignored');

    expect(onImagePaste).toHaveBeenCalledWith(pastedImage);
    expect(mocks.getClipboardText).not.toHaveBeenCalled();
    expect(mocks.superHandleInput).not.toHaveBeenCalled();
  });
});

describe('CustomEditor voice push-to-talk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Other describe blocks may leave a custom matchesKey implementation;
    // reset it so plain spaces are not misread as another shortcut.
    mocks.matchesKey.mockImplementation(() => false);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeVoiceHook(overrides: Partial<Record<string, any>> = {}) {
    return {
      isEnabled: vi.fn(() => true),
      isRecording: vi.fn(() => false),
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      ...overrides,
    };
  }

  it('does not engage voice handling when voice input is disabled', () => {
    const editor = new CustomEditor({} as any, {} as any);
    const hook = makeVoiceHook({ isEnabled: vi.fn(() => false) });
    editor.voiceInput = hook;

    for (let i = 0; i < 6; i++) {
      editor.handleInput(' ');
      vi.advanceTimersByTime(80);
    }

    expect(hook.startRecording).not.toHaveBeenCalled();
  });

  it('types single space taps instantly without lag', () => {
    const editor = new CustomEditor({} as any, {} as any);
    const hook = makeVoiceHook();
    editor.voiceInput = hook;

    editor.handleInput(' ');

    // Space is passed straight through immediately — no deferral.
    expect(mocks.superHandleInput).toHaveBeenCalledWith(' ');
    expect(hook.startRecording).not.toHaveBeenCalled();
  });

  it('does not trigger on slow, deliberate spaces', () => {
    const editor = new CustomEditor({} as any, {} as any);
    const hook = makeVoiceHook();
    editor.voiceInput = hook;

    for (let i = 0; i < 5; i++) {
      editor.handleInput(' ');
      vi.advanceTimersByTime(400); // slower than the repeat-gap threshold
    }

    expect(hook.startRecording).not.toHaveBeenCalled();
  });

  it('starts recording after a rapid space-repeat burst (held key)', () => {
    const editor = new CustomEditor({} as any, {} as any);
    const hook = makeVoiceHook();
    editor.voiceInput = hook;

    // Simulate terminal auto-repeat at ~84ms cadence.
    editor.handleInput(' ');
    vi.advanceTimersByTime(84);
    editor.handleInput(' ');
    vi.advanceTimersByTime(84);
    editor.handleInput(' '); // third rapid space confirms a hold

    expect(hook.startRecording).toHaveBeenCalledTimes(1);
    // The two literal spaces typed before detection are deleted via backspace.
    const backspaces = mocks.superHandleInput.mock.calls.filter(c => c[0] === '\x7f');
    expect(backspaces.length).toBe(2);
  });

  it('stops recording once auto-repeat stops (key released)', () => {
    const editor = new CustomEditor({} as any, {} as any);
    const hook = makeVoiceHook();
    editor.voiceInput = hook;

    editor.handleInput(' ');
    vi.advanceTimersByTime(84);
    editor.handleInput(' ');
    vi.advanceTimersByTime(84);
    editor.handleInput(' '); // recording starts
    vi.advanceTimersByTime(84);
    editor.handleInput(' '); // repeat keeps it alive

    expect(hook.stopRecording).not.toHaveBeenCalled();

    // Repeats stop; release idle window elapses.
    vi.advanceTimersByTime(300);

    expect(hook.stopRecording).toHaveBeenCalledTimes(1);
  });

  it('inserts the transcript text and requests a render so it shows immediately', () => {
    const requestRender = vi.fn();
    const editor = new CustomEditor({ requestRender } as any, {} as any);
    let text = '';
    editor.getText = vi.fn(() => text);
    mocks.editorSetText.mockImplementation((next: string) => {
      text = next;
    });

    editor.insertVoiceTranscript('hello world');

    expect(mocks.editorSetText).toHaveBeenCalledWith('hello world');
    expect(text).toBe('hello world');
    expect(requestRender).toHaveBeenCalled();
  });

  it('separates dictated text from existing content with a leading space', () => {
    const requestRender = vi.fn();
    const editor = new CustomEditor({ requestRender } as any, {} as any);
    let text = 'foo';
    editor.getText = vi.fn(() => text);
    mocks.editorSetText.mockImplementation((next: string) => {
      text = next;
    });

    // Listening captures the cursor anchor (end of "foo") as the dictation point.
    editor.setVoiceListening(true);
    editor.insertVoiceTranscript('bar');

    expect(text).toBe('foo bar');
  });

  it('replaces the dictated run with each live partial instead of appending', () => {
    const requestRender = vi.fn();
    const editor = new CustomEditor({ requestRender } as any, {} as any);
    let text = 'note: ';
    editor.getText = vi.fn(() => text);
    mocks.editorSetText.mockImplementation((next: string) => {
      text = next;
    });

    // Anchor dictation after the existing "note: " prefix.
    editor.setVoiceListening(true);

    editor.replaceVoiceTranscript('hello');
    expect(text).toBe('note: hello');

    // A fuller partial supersedes the previous one, keeping the base intact.
    editor.replaceVoiceTranscript('hello world');
    expect(text).toBe('note: hello world');
  });

  it('ignores a late partial transcript after the user resumes typing', () => {
    const requestRender = vi.fn();
    const editor = new CustomEditor({ requestRender } as any, {} as any);
    let text = '';
    editor.getText = vi.fn(() => text);
    mocks.editorSetText.mockImplementation((next: string) => {
      text = next;
    });

    editor.setVoiceListening(true);
    editor.replaceVoiceTranscript('hello');
    expect(text).toBe('hello');

    // User edits — the dictation session is no longer active.
    mocks.matchesKey.mockReturnValue(false);
    editor.handleInput('x');

    // A stale partial that arrives afterward must not clobber the user's input.
    editor.replaceVoiceTranscript('hello world');
    expect(text).not.toBe('hello world');
  });

  it('drives a listening animation timer while recording', () => {
    const requestRender = vi.fn();
    const editor = new CustomEditor({ requestRender } as any, {} as any);

    editor.setVoiceListening(true);
    requestRender.mockClear();

    // The pulse timer should tick and request renders on its own.
    vi.advanceTimersByTime(360);
    expect(requestRender).toHaveBeenCalled();

    requestRender.mockClear();
    editor.setVoiceListening(false);
    vi.advanceTimersByTime(360);
    // After stopping, no further animation ticks occur.
    expect(requestRender).toHaveBeenCalledTimes(1); // only the stop's own render
  });

  it('renders dictated text greyed-out and stops greying once edited', async () => {
    const { theme } = await import('../../theme.js');
    const [r, g, b] = theme
      .getTheme()
      .muted.match(/\w\w/g)!
      .map(h => parseInt(h, 16));
    const greySeq = `\x1b[38;2;${r};${g};${b}m`;

    const editor = new CustomEditor({ requestRender: vi.fn() } as any, {} as any);
    let text = '';
    editor.getText = vi.fn(() => text);
    editor.setText = vi.fn((t: string) => {
      text = t;
    });
    (editor as any).insertTextAtCursor = undefined;

    // Mimic a realistic pi-tui content line: the dictated text, an APC cursor
    // marker, a reverse-video cursor at the end, and trailing box padding.
    const realisticLine = () => ['────', `hello world\x1b_pi:c\x07\x1b[7m \x1b[0m     `, '────'];
    mocks.superRender.mockImplementation(realisticLine);

    editor.insertVoiceTranscript('hello world');
    const out = editor.render(40).join('\n');
    // The dictated run is greyed...
    expect(out).toContain(`${greySeq}hello world`);
    // ...while the cursor highlight and trailing padding are left intact.
    expect(out).toContain('\x1b[7m \x1b[0m');

    // A genuine keystroke marks the text as user-owned; greying stops.
    mocks.matchesKey.mockReturnValue(false);
    editor.handleInput('x');
    expect(editor.render(40).join('\n')).not.toContain(greySeq);
  });

  it('renders an animated soundwave bar while listening', () => {
    const editor = new CustomEditor({ requestRender: vi.fn() } as any, {} as any);
    editor.getText = vi.fn(() => 'hello');
    editor.getModeColor = vi.fn(() => '#16c858');

    editor.setVoiceListening(true);
    const output = editor.render(20).join('\n');
    const waveBars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    expect(waveBars.some(bar => output.includes(bar))).toBe(true);
  });
});
