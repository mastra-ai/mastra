import { KnowledgeBrowserComponent } from '../components/knowledge-browser.js';
import { showModalOverlay } from '../overlay.js';
import type { SlashCommandContext } from './types.js';

export async function handleKnowledgeCommand(ctx: SlashCommandContext): Promise<void> {
  if (!ctx.knowledgeInspector) {
    ctx.showError('Knowledge inspection is unavailable. Enable MastraCode memory with a knowledge-capable store.');
    return;
  }

  return new Promise(resolve => {
    const browser = new KnowledgeBrowserComponent({
      tui: ctx.state.ui,
      inspector: ctx.knowledgeInspector!,
      onClose: () => {
        ctx.state.ui.hideOverlay();
        resolve();
      },
    });
    showModalOverlay(ctx.state.ui, browser, { widthPercent: 0.9, maxWidth: 140, maxHeight: '85%' });
    browser.focused = true;
  });
}
