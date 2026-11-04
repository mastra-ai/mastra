import { KnowledgeBrowserComponent } from '../components/knowledge-browser.js';
import { showModalOverlay } from '../overlay.js';
import { isKnowledgeEnabled } from '../utils/experimental-features.js';
import type { SlashCommandContext } from './types.js';

// TODO: Add public documentation before this experimental browser is announced.
export async function handleKnowledgeCommand(ctx: SlashCommandContext): Promise<void> {
  if (!isKnowledgeEnabled()) {
    ctx.showError('Unknown command: /knowledge');
    return;
  }
  const inspector = ctx.knowledgeInspector;
  if (!inspector) {
    ctx.showError(
      ctx.knowledgeInspectorUnavailableReason ??
        'Knowledge inspection is unavailable. Turn on Experimental Knowledge in /settings and restart Mastra Code.',
    );
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
