/**
 * Shared context passed to extracted slash command handlers.
 * Keeps commands decoupled from the MastraTUI class.
 */
import type { MastraCodeAnalytics } from '@mastra/code-sdk/analytics';
import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import type { HookManager } from '@mastra/code-sdk/hooks/index';
import type { McpManager } from '@mastra/code-sdk/mcp/manager';
import type { PluginManager } from '@mastra/code-sdk/plugins/manager';
import type { SlashCommandMetadata } from '@mastra/code-sdk/utils/slash-command-loader';
import type { AgentController, MastraDBMessage, Session } from '@mastra/core/agent-controller';
import type { Workspace } from '@mastra/core/workspace';
import type { TUIState } from '../state.js';

export interface SlashCommandContext {
  state: TUIState;
  controller: AgentController<any>;
  session: Session<any>;
  hookManager?: HookManager;
  mcpManager?: McpManager;
  pluginManager?: PluginManager;
  analytics?: MastraCodeAnalytics;
  authStorage?: AuthStorage;
  customSlashCommands: SlashCommandMetadata[];
  showInfo: (message: string) => void;
  showError: (message: string) => void;
  updateStatusLine: () => void;
  stop: () => void;
  getResolvedWorkspace: () => Workspace | undefined;
  addUserMessage: (message: MastraDBMessage) => void;
  renderExistingMessages: () => Promise<void>;
  showOnboarding: () => Promise<void>;
}
