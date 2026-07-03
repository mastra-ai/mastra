/**
 * Shared context passed to extracted slash command handlers.
 * Keeps commands decoupled from the MastraTUI class.
 */
import type { MastraCodeAnalytics } from '@internal/mastracode/analytics';
import type { AuthStorage } from '@internal/mastracode/auth/storage';
import type { HookManager } from '@internal/mastracode/hooks/index';
import type { McpManager } from '@internal/mastracode/mcp/manager';
import type { PluginManager } from '@internal/mastracode/plugins/manager';
import type { SlashCommandMetadata } from '@internal/mastracode/utils/slash-command-loader';
import type { AgentController, AgentControllerMessage, Session } from '@mastra/core/agent-controller';
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
  addUserMessage: (message: AgentControllerMessage) => void;
  renderExistingMessages: () => Promise<void>;
  showOnboarding: () => Promise<void>;
}
