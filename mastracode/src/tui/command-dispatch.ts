/**
 * Slash command dispatcher: routes command strings to extracted handlers.
 */
import { processSlashCommand } from '../utils/slash-command-processor.js';
import {
  handleHelpCommand,
  handleCostCommand,
  handleYoloCommand,
  handleThinkCommand,
  handlePermissionsCommand,
  handleNameCommand,
  handleExitCommand,
  handleHooksCommand,
  handleMcpCommand,
  handleModeCommand,
  handleSkillsCommand,
  handleNewCommand,
  handleResourceCommand,
  handleDiffCommand,
  handleThreadsCommand,
  handleThreadTagDirCommand,
  handleSandboxCommand as handleSandboxCmd,
  handleModelsCommand,
  handleSubagentsCommand,
  handleOMCommand,
  handleSettingsCommand,
  handleLoginCommand,
  handleReviewCommand as handleReviewCmd,
} from './commands/index.js';
import type { SlashCommandContext } from './commands/types.js';
import { SlashCommandComponent } from './components/slash-command.js';
import { showError, showInfo } from './display.js';
import type { TUIState } from './state.js';

/**
 * Dispatch a slash command input to the appropriate handler.
 * Returns true if the command was handled (or was unknown), false if not a command.
 */
export async function dispatchSlashCommand(
  input: string,
  state: TUIState,
  buildCtx: () => SlashCommandContext,
): Promise<boolean> {
  const trimmedInput = input.trim();

  // Strip leading slashes — pi-tui may pass /command or command depending
  // on how the user invoked it.  Try custom commands first, then built-in.
  const withoutSlashes = trimmedInput.replace(/^\/+/, '');
  if (trimmedInput.startsWith('/')) {
    const [cmdName, ...cmdArgs] = withoutSlashes.split(' ');
    const customCommand = state.customSlashCommands.find(cmd => cmd.name === cmdName);
    if (customCommand) {
      await handleCustomSlashCommand(state, customCommand, cmdArgs);
      return true;
    }
    // Not a custom command — fall through to built-in routing
  }

  const [command, ...args] = withoutSlashes.split(' ');

  switch (command) {
    case 'new':
      handleNewCommand(buildCtx());
      return true;
    case 'threads':
      await handleThreadsCommand(buildCtx());
      return true;
    case 'skills':
      await handleSkillsCommand(buildCtx());
      return true;
    case 'thread:tag-dir':
      await handleThreadTagDirCommand(buildCtx());
      return true;
    case 'sandbox':
      await handleSandboxCmd(buildCtx(), args);
      return true;
    case 'mode':
      await handleModeCommand(buildCtx(), args);
      return true;
    case 'models':
      await handleModelsCommand(buildCtx());
      return true;
    case 'subagents':
      await handleSubagentsCommand(buildCtx());
      return true;
    case 'om':
      await handleOMCommand(buildCtx());
      return true;
    case 'think':
      await handleThinkCommand(buildCtx());
      return true;
    case 'permissions':
      await handlePermissionsCommand(buildCtx(), args);
      return true;
    case 'yolo':
      handleYoloCommand(buildCtx());
      return true;
    case 'settings':
      await handleSettingsCommand(buildCtx());
      return true;
    case 'login':
      await handleLoginCommand(buildCtx(), 'login');
      return true;
    case 'logout':
      await handleLoginCommand(buildCtx(), 'logout');
      return true;
    case 'cost':
      handleCostCommand(buildCtx());
      return true;
    case 'diff':
      await handleDiffCommand(buildCtx(), args[0]);
      return true;
    case 'name':
      await handleNameCommand(buildCtx(), args);
      return true;
    case 'resource':
      await handleResourceCommand(buildCtx(), args);
      return true;
    case 'exit':
      handleExitCommand(buildCtx());
      return true;
    case 'help':
      handleHelpCommand(buildCtx());
      return true;
    case 'hooks':
      handleHooksCommand(buildCtx(), args);
      return true;
    case 'mcp':
      await handleMcpCommand(buildCtx(), args);
      return true;
    case 'review':
      await handleReviewCmd(buildCtx(), args);
      return true;
    default: {
      const customCommand = state.customSlashCommands.find(cmd => cmd.name === command);
      if (customCommand) {
        await handleCustomSlashCommand(state, customCommand, args);
        return true;
      }
      showError(state, `Unknown command: ${command}`);
      return true;
    }
  }
}

/**
 * Handle a custom slash command by processing its template and adding to context.
 */
async function handleCustomSlashCommand(
  state: TUIState,
  command: { name: string; template: string; description?: string },
  args: string[],
): Promise<void> {
  try {
    // Process the command template
    const processedContent = await processSlashCommand(command as any, args, process.cwd());
    // Add the processed content as a system message / context
    if (processedContent.trim()) {
      // Show bordered indicator immediately with content
      const slashComp = new SlashCommandComponent(command.name, processedContent.trim());
      state.allSlashCommandComponents.push(slashComp);
      state.chatContainer.addChild(slashComp);
      state.ui.requestRender();

      // Wrap in <slash-command> tags so the assistant sees the full
      // content but addUserMessage won't double-render it.
      const wrapped = `<slash-command name="${command.name}">\n${processedContent.trim()}\n</slash-command>`;
      await state.harness.sendMessage({ content: wrapped });
    } else {
      showInfo(state, `Executed //${command.name} (no output)`);
    }
  } catch (error) {
    showError(state, `Error executing //${command.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
