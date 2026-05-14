/**
 * v1 TUI — milestone 2: render with pi-tui.
 *
 * Builds a real pi-tui layout (banner + chat container + editor container +
 * footer), bootstraps a Session, and streams Harness events into the chat
 * container as `Text` lines. No input handling or commands yet — that lands
 * in the next milestone.
 *
 * The legacy TUI's bootstrap pattern lives in `src/tui/state.ts` +
 * `src/tui/setup.ts`. This file deliberately re-derives the minimum slice
 * we need from scratch so v1 doesn't import anything from `src/tui/`.
 */
import { Container, Editor, ProcessTerminal, Spacer, Text, TUI } from '@mariozechner/pi-tui';
import type { EditorTheme } from '@mariozechner/pi-tui';
import type { Harness, HarnessEvent } from '@mastra/core/harness/v1';

const identity = (s: string) => s;
const PLAIN_EDITOR_THEME: EditorTheme = {
  borderColor: identity,
  selectList: {
    selectedPrefix: identity,
    selectedText: identity,
    description: identity,
    scrollInfo: identity,
    noMatch: identity,
  },
};

const RESOURCE_ID = 'mastracode-v1-local';
const TERM_WIDTH_BUFFER = 1; // matches legacy TUI's safety margin

export interface MastraTUIV1Options {
  harness: Harness;
  projectRoot: string;
}

export class MastraTUIV1 {
  private readonly harness: Harness;
  private readonly projectRoot: string;

  // pi-tui primitives
  private readonly terminal: ProcessTerminal;
  private readonly ui: TUI;
  private readonly chatContainer: Container;
  private readonly editorContainer: Container;
  private readonly footer: Container;
  private readonly editor: Editor;
  private readonly statusLine: Text;

  constructor(opts: MastraTUIV1Options) {
    this.harness = opts.harness;
    this.projectRoot = opts.projectRoot;

    this.terminal = new ProcessTerminal();
    // Match legacy: cap width to avoid wrap glitches in nested emulators.
    Object.defineProperty(this.terminal, 'columns', {
      get: () => (process.stdout.columns || 80) - TERM_WIDTH_BUFFER,
    });
    this.ui = new TUI(this.terminal);
    this.chatContainer = new Container();
    this.editorContainer = new Container();
    this.footer = new Container();
    this.editor = new Editor(this.ui, PLAIN_EDITOR_THEME);
    this.statusLine = new Text('', 0, 0);
  }

  async run(): Promise<void> {
    // 1) Build layout.
    this.ui.addChild(new Spacer(1));
    this.ui.addChild(new Text('  MastraCode v1 — milestone 2 (pi-tui render)', 1, 0));
    this.ui.addChild(new Text(`  project: ${this.projectRoot}`, 1, 0));
    this.ui.addChild(new Text(`  resource: ${RESOURCE_ID}`, 1, 0));
    this.ui.addChild(new Spacer(1));
    this.ui.addChild(this.chatContainer);
    this.ui.addChild(this.editorContainer);
    this.editorContainer.addChild(this.editor);
    this.footer.addChild(this.statusLine);
    this.ui.addChild(this.footer);
    this.ui.setFocus(this.editor);

    // 2) Subscribe to events BEFORE opening the session so we capture
    //    session_created etc.
    const unsubscribe = this.harness.subscribe(event => this.appendEvent(event));

    // 3) Resolve thread + open session.
    const thread = await this.harness.threads.selectOrCreate({
      resourceId: RESOURCE_ID,
      title: 'mastracode v1 — default',
    });
    const session = await this.harness.session({
      resourceId: RESOURCE_ID,
      threadId: thread.id,
    });

    // 4) Seed the chat container + status line with current identity.
    this.appendLine(`thread:  ${thread.id}`);
    this.appendLine(`session: ${session.id}`);
    this.appendLine(`mode:    ${session.getCurrentMode().id}`);
    this.appendLine(`model:   ${session.models.current() || '<none>'}`);
    this.appendLine('--- live event stream below ---');
    this.statusLine.setText(
      `  session=${session.id.slice(0, 12)}…  mode=${session.getCurrentMode().id}  (Ctrl+C to exit)`,
    );

    // 5) Start the UI. This takes over the terminal.
    this.ui.start();

    // 6) Wire Ctrl+C → graceful shutdown.
    await new Promise<void>(resolve => {
      const onSignal = () => {
        process.removeListener('SIGINT', onSignal);
        resolve();
      };
      process.once('SIGINT', onSignal);
    });

    // 7) Tear down.
    unsubscribe();
    this.ui.stop();
    await this.harness.shutdown();
    process.stdout.write('\n  shutdown clean.\n\n');
  }

  /** Append a plain line to the chat container. */
  private appendLine(text: string): void {
    this.chatContainer.addChild(new Text(text, 1, 0));
    this.ui.requestRender();
  }

  /** Render an event as a single chat line. */
  private appendEvent(event: HarnessEvent): void {
    const { type, sessionId } = event as { type: string; sessionId?: string };
    const tag = sessionId ? `${type} (sess=${sessionId.slice(0, 12)}…)` : type;
    this.appendLine(`[event] ${tag}`);
  }
}
