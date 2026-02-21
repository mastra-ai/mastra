/**
 * Shared context passed to extracted slash command handlers.
 * Keeps commands decoupled from the MastraTUI class.
 */
import type { Harness, HarnessMessage } from '@mastra/core/harness';
import type { Workspace } from '@mastra/core/workspace';
import type { AuthStorage } from '../../auth/storage.js';
import type { HookManager } from '../../hooks/index.js';
import type { McpManager } from '../../mcp/manager.js';
import type { SlashCommandMetadata } from '../../utils/slash-command-loader.js';
import type { TUIState } from '../state.js';

export interface SlashCommandContext {
  state: TUIState;
  harness: Harness<any>;
  hookManager?: HookManager;
  mcpManager?: McpManager;
  authStorage?: AuthStorage;
  customSlashCommands: SlashCommandMetadata[];
  showInfo: (message: string) => void;
  showError: (message: string) => void;
  updateStatusLine: () => void;
  resetStatusLineState: () => void;
  stop: () => void;
  getResolvedWorkspace: () => Workspace | undefined;
  addUserMessage: (message: HarnessMessage) => void;
  renderExistingMessages: () => Promise<void>;
}
