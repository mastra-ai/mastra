/**
 * Slash command dispatcher: routes command strings to extracted handlers.
 */
import { processSlashCommand } from '@mastra/code-sdk/utils/slash-command-processor';
import { insertChatComponentWithBoundarySpacing } from './chat-boundary-reconciliation.js';
import { startGoalWithDefaults } from './commands/goal.js';
import {
  handleHelpCommand,
  handleCostCommand,
  handleYoloCommand,
  handleVoiceCommand,
  handleThinkCommand,
  handlePermissionsCommand,
  handleNameCommand,
  handleExitCommand,
  handleHooksCommand,
  handleMcpCommand,
  handleModeCommand,
  handleSkillCommand,
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
  handleMastraGatewayCommand,
  handleApiKeysCommand,
  handlePluginsCommand,
  handleFeedbackCommand,
  handleObservabilityCommand,
  handleGithubCommand,
  handleGoalCommand,
  handleWorkflowsCommand,
  handlePruneCommand,
} from './commands/index.js';
import { isCurrentThreadActive, sendSlashCommandMessage } from './commands/send-slash-command-message.js';
import type { SlashCommandContext } from './commands/types.js';
import { SlashCommandComponent } from './components/slash-command.js';
import { showError, showInfo } from './display.js';
import {
  canRunSlashCommandDuringGoalJudge,
  isGoalJudgeInputLocked,
  showGoalJudgeInputLockInfo,
} from './goal-input-lock.js';
import type { TUIState } from './state.js';

const TRACKED_COMMANDS = new Set([
  'login',
  'models',
  'mode',
  'gateway',
  'memory-gateway',
  'custom-providers',
  'threads',
  'new',
]);

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
      action: 'attempted',
      threadId: state.session.thread.getId(),
      resourceId: state.session.identity.getResourceId(),
      mode: state.session.mode.get(),
    });
  };
  const trimmedInput = input.trim();

  const slashMatch = trimmedInput.match(/^(\/\/?)([\s\S]*)$/);
  const slashPrefix = slashMatch?.[1] ?? '';
  const withoutSlashes = slashMatch?.[2] ?? trimmedInput;
  const firstWhitespaceIndex = withoutSlashes.search(/\s/);
  const commandText = firstWhitespaceIndex === -1 ? withoutSlashes : withoutSlashes.slice(0, firstWhitespaceIndex);
  const rawArgsText = firstWhitespaceIndex === -1 ? '' : withoutSlashes.slice(firstWhitespaceIndex).trim();
  const parsedArgs = rawArgsText ? rawArgsText.split(/\s+/) : [];

  if (slashPrefix === '//') {
    if (isGoalJudgeInputLocked(state)) {
      showGoalJudgeInputLockInfo(state);
      return true;
    }

    const cmdName = commandText;
    const cmdArgs = parsedArgs;
    const customCommand = state.customSlashCommands.find(cmd => cmd.name === cmdName);
    if (customCommand) {
      await handleCustomSlashCommand(
        state,
        customCommand,
        cmdArgs,
        buildCtx(),
        `//${cmdName}${rawArgsText ? ` ${rawArgsText}` : ''}`,
      );
      return true;
    }

    showError(state, `Unknown custom command: ${cmdName}`);
    return true;
  }

  const command = commandText;
  const goalSubcommands = new Set(['status', 'pause', 'resume', 'clear']);
  const firstGoalArg = parsedArgs[0]?.toLowerCase();
  const args =
    command === 'goal' && rawArgsText && !goalSubcommands.has(firstGoalArg ?? '') ? [rawArgsText] : parsedArgs;

  if (!command) {
    return true;
  }

  if (isGoalJudgeInputLocked(state) && !canRunSlashCommandDuringGoalJudge(command, args)) {
    showGoalJudgeInputLockInfo(state);
    return true;
  }

  const ctx = buildCtx();
  trackCommand(ctx, command);

  if (command.startsWith('goal/')) {
    await handleGoalSourceCommand(state, command.slice('goal/'.length), args, ctx);
    return true;
  }

  if (command.startsWith('skill/')) {
    await handleSkillCommand(buildCtx(), command.slice('skill/'.length), args);
    return true;
  }

  switch (command) {
    case 'new':
      await handleNewCommand(ctx);
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
    case 'workflows':
    case 'workflow':
      await handleWorkflowsCommand(ctx, args);
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
    case 'memory':
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
    case 'voice':
      await handleVoiceCommand(ctx, args);
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
    case 'prune':
      await handlePruneCommand(ctx, args);
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
    case 'gateway':
    case 'memory-gateway':
      await handleMastraGatewayCommand(ctx);
      return true;
    case 'api-keys':
      await handleApiKeysCommand(buildCtx());
      return true;
    case 'plugins':
      await handlePluginsCommand(buildCtx(), args);
      return true;
    case 'feedback':
      await handleFeedbackCommand(buildCtx(), args);
      return true;
    case 'observability':
      await handleObservabilityCommand(buildCtx(), args);
      return true;
    case 'github':
      await handleGithubCommand(buildCtx(), args);
      return true;
    case 'goal':
      await handleGoalCommand(buildCtx(), args);
      return true;
    default: {
      const customCommand = state.customSlashCommands.find(cmd => cmd.name === command);
      if (customCommand) {
        await handleCustomSlashCommand(
          state,
          customCommand,
          args,
          ctx,
          `/${command}${rawArgsText ? ` ${rawArgsText}` : ''}`,
        );
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
async function handleGoalSourceCommand(
  state: TUIState,
  sourceName: string,
  args: string[],
  ctx: SlashCommandContext,
): Promise<void> {
  const customCommand = state.customSlashCommands.find(cmd => cmd.name === sourceName && cmd.goal === true);
  if (customCommand) {
    try {
      const processedContent = await processSlashCommand(customCommand, args, process.cwd());
      const objective = processedContent.trim();
      if (!objective) {
        showInfo(state, `Goal command /goal/${customCommand.name} produced no output.`);
        return;
      }
      await startGoalWithDefaults(ctx, objective);
    } catch (error) {
      showError(
        state,
        `Error executing /goal/${sourceName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return;
  }

  const goalSkill = state.goalSkillCommands.find(skill => skill.name === sourceName);
  if (goalSkill) {
    try {
      let workspace = ctx.getResolvedWorkspace();
      if (!workspace && ctx.controller?.hasWorkspace?.()) {
        workspace = await ctx.controller.resolveWorkspace({ session: ctx.state.session });
      }
      const skill = await workspace?.skills?.get(goalSkill.path || goalSkill.name);
      if (!skill || skill.metadata?.goal !== true) {
        showError(state, `Unknown goal command: ${sourceName}`);
        return;
      }
      const trimmedArgs = args.join(' ').trim();
      const objective = `# Skill goal: ${skill.name}\n\n${skill.instructions}${
        trimmedArgs ? `\n\nARGUMENTS: ${trimmedArgs}` : ''
      }`;
      await startGoalWithDefaults(ctx, objective);
    } catch (error) {
      showError(
        state,
        `Error executing /goal/${sourceName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return;
  }

  showError(state, `Unknown goal command: ${sourceName}`);
}

async function handleCustomSlashCommand(
  state: TUIState,
  command: { name: string; template: string; description?: string },
  args: string[],
  ctx: SlashCommandContext,
  displayText: string,
): Promise<void> {
  try {
    // Process the command template
    const processedContent = await processSlashCommand(command as any, args, process.cwd());
    // Add the processed content as a system message / context
    if (processedContent.trim()) {
      const commandCtx = { ...ctx, state, controller: ctx.controller ?? state.controller } as SlashCommandContext;
      if (!isCurrentThreadActive(commandCtx)) {
        const slashComp = new SlashCommandComponent(command.name, processedContent.trim());
        state.allSlashCommandComponents.push(slashComp);
        insertChatComponentWithBoundarySpacing(state.chatContainer, slashComp);
        state.ui.requestRender();
      }

      // Wrap in <slash-command> tags so the assistant sees the full
      // content but addUserMessage won't double-render it.
      const wrapped = `<slash-command name="${command.name}">\n${processedContent.trim()}\n</slash-command>`;
      await sendSlashCommandMessage(commandCtx, displayText, wrapped, { renderIdleUserMessage: false });
    } else {
      showInfo(state, `Executed //${command.name} (no output)`);
    }
  } catch (error) {
    showError(state, `Error executing //${command.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
