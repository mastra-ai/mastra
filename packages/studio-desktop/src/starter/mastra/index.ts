import { Mastra } from '@mastra/core/mastra';
import { FilesystemStore } from '@mastra/core/storage';
import { MastraEditor } from '@mastra/editor';
import { desktopAssistant } from './agents/desktop-assistant';
import { DesktopLocalModelGateway } from './local-model-gateway';

export const mastra = new Mastra({
  bundler: {
    externals: false,
  },
  agents: {
    desktopAssistant,
  },
  gateways: {
    'desktop-local': new DesktopLocalModelGateway(),
  },
  storage: new FilesystemStore({
    dir: process.env.MASTRA_DESKTOP_STORAGE_DIR || './mastra-desktop-storage',
  }),
  editor: new MastraEditor(),
});
