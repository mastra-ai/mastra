import { KnowledgeBrowserComponent } from '../components/knowledge-browser.js';
import { showModalOverlay } from '../overlay.js';
import { isSubconsciousEnabled } from '../utils/experimental-features.js';
import type { SlashCommandContext } from './types.js';

// TODO: Add public documentation before this experimental browser is announced.
export async function handleKnowledgeCommand(ctx: SlashCommandContext): Promise<void> {
  if (!isSubconsciousEnabled()) {
    ctx.showError('Unknown command: /knowledge');
    return;
  }
  const inspector = ctx.knowledgeInspector;
  if (!inspector) {
    ctx.showError('Knowledge inspection is unavailable. Configure the default Knowledge runtime for this session.');
    return;
  }

  return new Promise(resolve => {
    const browser = new KnowledgeBrowserComponent({
      tui: ctx.state.ui,
      inspector,
      onClose: () => {
        ctx.state.ui.hideOverlay();
        resolve();
      },
    });
    showModalOverlay(ctx.state.ui, browser, { widthPercent: 0.9, maxWidth: 140, maxHeight: '85%' });
    browser.focused = true;
  });
}
