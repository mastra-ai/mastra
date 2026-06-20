import { Mastra } from '@mastra/core/mastra';
import { FilesystemStore } from '@mastra/core/storage';
import { MastraEditor } from '@mastra/editor';
import { desktopAssistant } from './agents/desktop-assistant';

export const mastra = new Mastra({
  bundler: {
    externals: false,
  },
  agents: {
    desktopAssistant,
  },
  storage: new FilesystemStore({
    dir: process.env.MASTRA_DESKTOP_STORAGE_DIR || './mastra-desktop-storage',
  }),
  editor: new MastraEditor(),
});
