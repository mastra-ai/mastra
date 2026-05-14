/**
 * v1 TUI — milestone 3: input → session.message() + assistant streaming.
 *
 * Builds a pi-tui layout (banner + chat container + editor + footer),
 * bootstraps a Session, wires Enter in the editor to `session.message()`,
 * and renders streaming assistant text by accumulating `message_update`
 * deltas into a single chat line keyed by `messageId`.
 *
 * No commands yet — that lands next.
 */
import { Container, Editor, ProcessTerminal, Spacer, Text, TUI } from '@mariozechner/pi-tui';
import type { EditorTheme } from '@mariozechner/pi-tui';
import type { Harness, HarnessEvent, Session } from '@mastra/core/harness/v1';

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
const TERM_WIDTH_BUFFER = 1;

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

  // Active session (set in run()).
  private session?: Session;

  // Streaming assistant message slots: messageId → { textNode, buffer }.
  private readonly assistantSlots = new Map<string, { node: Text; buffer: string }>();

  constructor(opts: MastraTUIV1Options) {
    this.harness = opts.harness;
    this.projectRoot = opts.projectRoot;

    this.terminal = new ProcessTerminal();
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
    this.ui.addChild(new Text('  MastraCode v1 — milestone 3 (input + streaming)', 1, 0));
    this.ui.addChild(new Text(`  project: ${this.projectRoot}`, 1, 0));
    this.ui.addChild(new Text(`  resource: ${RESOURCE_ID}`, 1, 0));
    this.ui.addChild(new Spacer(1));
    this.ui.addChild(this.chatContainer);
    this.ui.addChild(this.editorContainer);
    this.editorContainer.addChild(this.editor);
    this.footer.addChild(this.statusLine);
    this.ui.addChild(this.footer);
    this.ui.setFocus(this.editor);

    // 2) Subscribe to events BEFORE opening the session.
    const unsubscribe = this.harness.subscribe(event => this.handleEvent(event));

    // 3) Resolve thread + open session.
    const thread = await this.harness.threads.selectOrCreate({
      resourceId: RESOURCE_ID,
      title: 'mastracode v1 — default',
    });
    this.session = await this.harness.session({
      resourceId: RESOURCE_ID,
      threadId: thread.id,
    });

    // 4) Seed chat + status line.
    this.appendLine(`thread:  ${thread.id}`);
    this.appendLine(`session: ${this.session.id}`);
    this.appendLine(`mode:    ${this.session.getCurrentMode().id}`);
    this.appendLine(`model:   ${this.session.models.current() || '<none>'}`);
    this.appendLine('--- type a message and press Enter ---');
    this.statusLine.setText(
      `  session=${this.session.id.slice(0, 12)}…  mode=${this.session.getCurrentMode().id}  (Ctrl+C to exit)`,
    );

    // 5) Wire Enter → session.message().
    this.editor.onSubmit = (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      this.editor.addToHistory(trimmed);
      // Editor clears its own buffer after onSubmit completes synchronously
      // for plain text input. Kick off the send in the background; render
      // user line first.
      this.appendLine(`> ${trimmed}`);
      void this.sendMessage(trimmed);
    };

    // 6) Start UI.
    this.ui.start();

    // 7) Wait for Ctrl+C.
    await new Promise<void>(resolve => {
      const onSignal = () => {
        process.removeListener('SIGINT', onSignal);
        resolve();
      };
      process.once('SIGINT', onSignal);
    });

    // 8) Teardown.
    unsubscribe();
    this.ui.stop();
    await this.harness.shutdown();
    process.stdout.write('\n  shutdown clean.\n\n');
  }

  private async sendMessage(content: string): Promise<void> {
    if (!this.session) return;
    try {
      const result = await this.session.message({ content });
      // Streaming deltas already painted the assistant line. If the final
      // text differs (e.g. result aggregated tool output), append a note.
      if (!this.assistantSlots.size && result.text) {
        this.appendLine(`assistant: ${result.text}`);
      }
    } catch (err) {
      this.appendLine(`error: ${(err as Error).message ?? String(err)}`);
    }
  }

  private appendLine(text: string): void {
    this.chatContainer.addChild(new Text(text, 1, 0));
    this.ui.requestRender();
  }

  /** Dispatch a Harness event to the right renderer. */
  private handleEvent(event: HarnessEvent): void {
    const e = event as { type: string; sessionId?: string; messageId?: string; delta?: string };
    switch (e.type) {
      case 'message_start': {
        if (!e.messageId) return;
        const node = new Text('', 1, 0);
        this.assistantSlots.set(e.messageId, { node, buffer: '' });
        this.chatContainer.addChild(node);
        this.ui.requestRender();
        return;
      }
      case 'message_update': {
        if (!e.messageId || typeof e.delta !== 'string') return;
        const slot = this.assistantSlots.get(e.messageId);
        if (!slot) return;
        slot.buffer += e.delta;
        slot.node.setText(slot.buffer);
        this.ui.requestRender();
        return;
      }
      case 'message_end': {
        if (!e.messageId) return;
        // Keep the line in place; just stop tracking it for future deltas.
        this.assistantSlots.delete(e.messageId);
        this.ui.requestRender();
        return;
      }
      default: {
        // Surface every other event as a faint debug line so we can see
        // the lifecycle while we wire things up.
        const tag = e.sessionId ? `${e.type} (sess=${e.sessionId.slice(0, 12)}…)` : e.type;
        this.appendLine(`[event] ${tag}`);
      }
    }
  }
}
