/**
 * Shared context passed to extracted slash command handlers.
 * Keeps commands decoupled from the MastraTUI class.
 */
import type { Harness, HarnessMessage, Session } from '@mastra/core/harness';
import type { Workspace } from '@mastra/core/workspace';
import type { MastraCodeAnalytics } from '../../analytics';
import type { AuthStorage } from '../../auth/storage';
import type { HookManager } from '../../hooks/index';
import type { McpManager } from '../../mcp/manager';
import type { SlashCommandMetadata } from '../../utils/slash-command-loader';
import type { TUIState } from '../state';

export interface SlashCommandContext {
  state: TUIState;
  harness: Harness<any>;
  session: Session<any>;
  hookManager?: HookManager;
  mcpManager?: McpManager;
  analytics?: MastraCodeAnalytics;
  authStorage?: AuthStorage;
  customSlashCommands: SlashCommandMetadata[];
  showInfo: (message: string) => void;
  showError: (message: string) => void;
  updateStatusLine: () => void;
  stop: () => void;
  getResolvedWorkspace: () => Workspace | undefined;
  addUserMessage: (message: HarnessMessage) => void;
  renderExistingMessages: () => Promise<void>;
  showOnboarding: () => Promise<void>;
}
