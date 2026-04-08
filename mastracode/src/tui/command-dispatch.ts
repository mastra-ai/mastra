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
  handleCloneCommand,
  handleResourceCommand,
  handleDiffCommand,
  handleThreadsCommand,
  handleThreadCommand,
  handleThreadTagDirCommand,
  handleSandboxCommand as handleSandboxCmd,
  handleModelsPackCommand,
  handleCustomProvidersCommand,
  handleSubagentsCommand,
  handleOMCommand,
  handleSettingsCommand,
  handleLoginCommand,
  handleReviewCommand as handleReviewCmd,
  handleReportIssueCommand as handleReportIssueCmd,
  handleSetupCommand,
  handleBrowserCommand,
  handleThemeCommand,
  handleUpdateCommand,
  handleMemoryGatewayCommand,
} from './commands/index.js';
import type { SlashCommandContext } from './commands/types.js';
import { SlashCommandComponent } from './components/slash-command.js';
import { showError, showInfo } from './display.js';
import type { TUIState } from './state.js';

const TRACKED_COMMANDS = new Set(['login', 'models', 'mode', 'memory-gateway', 'custom-providers', 'threads', 'new']);

/**
 * Dispatch a slash command input to the appropriate handler.
 * Returns true if the command was handled (or was unknown), false if not a command.
 */
export async function dispatchSlashCommand(
  input: string,
  state: TUIState,
  buildCtx: () => SlashCommandContext,
): Promise<boolean> {
  const trackCommand = (ctx: SlashCommandContext, command: string) => {
    if (!TRACKED_COMMANDS.has(command)) return;
    ctx.analytics?.trackCommand(command, {
      threadId: state.harness.getCurrentThreadId(),
      resourceId: state.harness.getResourceId(),
      mode: state.harness.getCurrentModeId(),
    });
  };
  const trimmedInput = input.trim();

  const slashMatch = trimmedInput.match(/^(\/\/?)(.*)$/);
  const slashPrefix = slashMatch?.[1] ?? '';
  const withoutSlashes = slashMatch?.[2] ?? trimmedInput;

  if (slashPrefix === '//') {
    const [cmdName, ...cmdArgs] = withoutSlashes.split(' ');
    const customCommand = state.customSlashCommands.find(cmd => cmd.name === cmdName);
    if (customCommand) {
      await handleCustomSlashCommand(state, customCommand, cmdArgs);
      return true;
    }

    showError(state, `Unknown custom command: ${cmdName}`);
    return true;
  }

  const [command, ...args] = withoutSlashes.split(' ');
  if (!command) {
    return true;
  }
  const ctx = buildCtx();
  trackCommand(ctx, command);

  switch (command) {
    case 'new':
      handleNewCommand(ctx);
      return true;
    case 'clone':
      await handleCloneCommand(ctx);
      return true;
    case 'threads':
      await handleThreadsCommand(ctx);
      return true;
    case 'thread':
      await handleThreadCommand(ctx);
      return true;
    case 'skills':
      await handleSkillsCommand(ctx);
      return true;
    case 'thread:tag-dir':
      await handleThreadTagDirCommand(ctx);
      return true;
    case 'sandbox':
      await handleSandboxCmd(ctx, args);
      return true;
    case 'mode':
      await handleModeCommand(ctx, args);
      return true;
    case 'models':
      await handleModelsPackCommand(ctx);
      return true;
    case 'custom-providers':
      await handleCustomProvidersCommand(ctx);
      return true;
    case 'subagents':
      await handleSubagentsCommand(ctx);
      return true;
    case 'om':
      await handleOMCommand(ctx);
      return true;
    case 'think':
      await handleThinkCommand(ctx, args);
      return true;
    case 'permissions':
      await handlePermissionsCommand(ctx, args);
      return true;
    case 'yolo':
      handleYoloCommand(ctx);
      return true;
    case 'settings':
      await handleSettingsCommand(ctx);
      return true;
    case 'login':
      await handleLoginCommand(ctx, 'login');
      return true;
    case 'logout':
      await handleLoginCommand(ctx, 'logout');
      return true;
    case 'cost':
      handleCostCommand(ctx);
      return true;
    case 'diff':
      await handleDiffCommand(ctx, args[0]);
      return true;
    case 'name':
      await handleNameCommand(ctx, args);
      return true;
    case 'resource':
      await handleResourceCommand(ctx, args);
      return true;
    case 'exit':
      handleExitCommand(ctx);
      return true;
    case 'help':
      handleHelpCommand(ctx);
      return true;
    case 'hooks':
      handleHooksCommand(ctx, args);
      return true;
    case 'mcp':
      await handleMcpCommand(ctx, args);
      return true;
    case 'review':
      await handleReviewCmd(ctx, args);
      return true;
    case 'report-issue':
      await handleReportIssueCmd(ctx, args);
      return true;
    case 'setup':
      await handleSetupCommand(ctx);
      return true;
    case 'browser':
      await handleBrowserCommand(ctx, args);
      return true;
    case 'theme':
      await handleThemeCommand(ctx, args);
      return true;
    case 'update':
      await handleUpdateCommand(ctx);
      return true;
    case 'memory-gateway':
      await handleMemoryGatewayCommand(ctx);
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
