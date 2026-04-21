/**
 * Minimal Mastra configuration that ships the Agent Builder (Agent Studio)
 * with no pre-built agents, workflows, tools, or MCP servers. Users create
 * everything from the Studio UI at runtime.
 */

import { Mastra } from '@mastra/core/mastra';
import { MastraEditor } from '@mastra/editor';
import { LibSQLStore } from '@mastra/libsql';
import { MastraAgentBuilder } from '@mastra/studio-agent-builder';

import { mastraAuth, rbacProvider } from './auth';

const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: 'file:./mastra.db',
});

export const mastra = new Mastra({
  storage,
  bundler: {
    sourcemap: true,
  },
  server: {
    auth: mastraAuth,
    rbac: rbacProvider,
  },
  editor: new MastraEditor(),
  agentBuilder: new MastraAgentBuilder({
    enabledSections: ['tools', 'memory', 'skills'],
    marketplace: {
      enabled: true,
      showAgents: true,
      showSkills: true,
    },
    configure: {
      allowSkillCreation: true,
      allowAppearance: true,
    },
    recents: { maxItems: 5 },
  }),
});
