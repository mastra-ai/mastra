import type { BrowserState } from '@mastra/core/browser';
import type { MastraCompositeStore } from '@mastra/core/storage';
import { z } from 'zod';

export interface SavedBrowserTabsOptions {
  storage: MastraCompositeStore;
  threadId: string;
  resourceId: string;
}

const stateSchema = z.object({
  tabs: z.array(z.object({ url: z.string().url() })),
  activeTabIndex: z.number().int().min(0),
});
const key = 'mastra_browser_saved_tabs';

/** Native thread storage owns saved URLs. Never persist cookies, forms or connection credentials. */
export class SavedBrowserTabs {
  constructor(private readonly options: SavedBrowserTabsOptions) {}

  private async scope() {
    const { storage, threadId, resourceId } = this.options;
    const memory = await storage.getStore('memory');
    if (!memory) throw new Error('Saved browser tabs require memory storage');
    const thread = await memory.getThreadById({ threadId, resourceId });
    if (!thread || thread.resourceId !== resourceId) throw new Error('Saved browser thread is unavailable');
    return { memory, thread };
  }

  async load(): Promise<BrowserState | undefined> {
    const { thread } = await this.scope();
    const value = thread.metadata?.[key];
    if (value === undefined) return undefined;
    return this.webPages(stateSchema.parse(value));
  }

  async save(state: BrowserState): Promise<void> {
    const { memory, thread } = await this.scope();
    await memory.patchThread({ id: thread.id, metadata: { [key]: this.webPages(state) } });
  }

  private webPages(state: BrowserState): BrowserState {
    const retained = state.tabs
      .map((tab, index) => ({ tab, index }))
      .filter(({ tab }) => {
        try {
          return ['http:', 'https:'].includes(new URL(tab.url).protocol) || tab.url === 'about:blank';
        } catch {
          return false;
        }
      });
    const selectedIndex = retained.findIndex(entry => entry.index === state.activeTabIndex);
    return { tabs: retained.map(({ tab }) => ({ url: tab.url })), activeTabIndex: Math.max(0, selectedIndex) };
  }
}
