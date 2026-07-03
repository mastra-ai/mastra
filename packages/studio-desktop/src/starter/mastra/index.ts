import { Mastra } from '@mastra/core/mastra';
import { FilesystemStore, MastraCompositeStore } from '@mastra/core/storage';
import { MastraEditor } from '@mastra/editor';
import { LibSQLStore } from '@mastra/libsql';
import { desktopAgents } from './agents/template-agents';
import { desktopBuilderAgent, getDesktopBuilderConfig } from './desktop-builder';
import { DesktopLocalModelGateway } from './local-model-gateway';

export const desktopRuntimeBundlerConfig = {
  externals: true,
} as const;

function getDesktopStorage() {
  const runtimeStore = new LibSQLStore({
    id: 'desktop-runtime-storage',
    url: process.env.MASTRA_DESKTOP_DB_URL || (process.env.VITEST ? ':memory:' : 'file:./mastra-desktop.db'),
  });

  return new MastraCompositeStore({
    id: 'desktop-storage',
    default: runtimeStore,
    editor: new FilesystemStore({
      dir: process.env.MASTRA_DESKTOP_STORAGE_DIR || './mastra-desktop-storage',
    }),
  });
}

export const mastra = new Mastra({
  bundler: {
    externals: true,
  },
  agents: {
    builderAgent: desktopBuilderAgent,
    ...desktopAgents,
  },
  gateways: {
    'desktop-local': new DesktopLocalModelGateway(),
  },
  storage: getDesktopStorage(),
  editor: new MastraEditor({
    builder: getDesktopBuilderConfig(),
  }),
});
