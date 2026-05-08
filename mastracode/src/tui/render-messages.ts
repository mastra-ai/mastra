/**
 * Message rendering helpers extracted from MastraTUI.
 *
 * Pure functions that operate on TUIState — no class dependency.
 */
import { Container, Spacer, Text } from '@mariozechner/pi-tui';
import type { Component } from '@mariozechner/pi-tui';
import type { HarnessMessage, HarnessMessageContent, TaskItem } from '@mastra/core/harness';
import { parseSubagentMeta } from '@mastra/core/harness';
import chalk from 'chalk';
import { AskQuestionInlineComponent } from './components/ask-question-inline.js';
import { AssistantMessageComponent } from './components/assistant-message.js';
import { OMMarkerComponent } from './components/om-marker.js';
import { OMOutputComponent } from './components/om-output.js';
import { PlanResultComponent } from './components/plan-approval-inline.js';
import { SlashCommandComponent } from './components/slash-command.js';
import { SubagentExecutionComponent } from './components/subagent-execution.js';
import { SystemReminderComponent } from './components/system-reminder.js';
import { TemporalGapComponent } from './components/temporal-gap.js';
import { ToolExecutionComponentEnhanced } from './components/tool-execution-enhanced.js';
import { UserMessageComponent } from './components/user-message.js';
import { formatToolResult } from './handlers/tool.js';
import type { TUIState } from './state.js';
import { BOX_INDENT, getMarkdownTheme, theme, mastra } from './theme.js';

// Re-export so existing consumers can still import from here
export { formatToolResult };

// =============================================================================
// renderCompletedTasksInline / renderClearedTasksInline
// =============================================================================

/**
 * Render a completed task list inline in the chat history.
 */
export function renderCompletedTasksInline(
  state: TUIState,
  tasks: TaskItem[],
  insertIndex = -1,
  collapsed = false,
): void {
  const headerText =
    theme.bold(theme.fg('accent', 'Tasks')) + theme.fg('dim', ` [${tasks.length}/${tasks.length} completed]`);

  const container = new Container();
  container.addChild(new Text(headerText, BOX_INDENT, 0));
  const MAX_VISIBLE = 4;
  const shouldCollapse = collapsed && tasks.length > MAX_VISIBLE + 1;
  const visible = shouldCollapse ? tasks.slice(0, MAX_VISIBLE) : tasks;
  const remaining = shouldCollapse ? tasks.length - MAX_VISIBLE : 0;

  for (const task of visible) {
    const icon = chalk.hex(mastra.green)('✓');
    const text = chalk.hex(mastra.green)(task.content);
    container.addChild(new Text(`  ${icon} ${text}`, BOX_INDENT, 0));
  }
  if (remaining > 0) {
    container.addChild(
      new Text(
        theme.fg('dim', `  ... ${remaining} more completed task${remaining > 1 ? 's' : ''} (ctrl+e to expand)`),
        BOX_INDENT,
        0,
      ),
    );
  }
  container.addChild(new Spacer(1));

  if (insertIndex >= 0) {
    state.chatContainer.children.splice(insertIndex, 0, container);
    state.chatContainer.invalidate();
  } else {
    state.chatContainer.addChild(container);
  }
}

/**
 * Render inline display when tasks are cleared.
 */
export function renderClearedTasksInline(state: TUIState, clearedTasks: TaskItem[], insertIndex = -1): void {
  const container = new Container();
  const count = clearedTasks.length;
  const label = count === 1 ? 'Task' : 'Tasks';
  container.addChild(new Text(theme.fg('accent', `${label} cleared`), BOX_INDENT, 0));
  for (const task of clearedTasks) {
    const icon = task.status === 'completed' ? chalk.hex(mastra.green)('✓') : chalk.hex(mastra.darkGray)('○');
    const text = chalk.hex(theme.getTheme().dim).strikethrough(task.content);
    container.addChild(new Text(`  ${icon} ${text}`, BOX_INDENT, 0));
  }
  container.addChild(new Spacer(1));
  if (insertIndex >= 0) {
    state.chatContainer.children.splice(insertIndex, 0, container);
    state.chatContainer.invalidate();
  } else {
    state.chatContainer.addChild(container);
  }
}

// =============================================================================
// addUserMessage
// =============================================================================

function createReminderComponent(
  reminderType: string | undefined,
  options: { message?: string; path?: string; gapText?: string; goalMaxTurns?: number; judgeModelId?: string },
): SystemReminderComponent | TemporalGapComponent {
  if (reminderType === 'temporal-gap') {
    return new TemporalGapComponent({
      message: options.message,
      gapText: options.gapText,
    });
  }

  return new SystemReminderComponent({
    message: options.message,
    reminderType,
    path: options.path,
    goalMaxTurns: options.goalMaxTurns,
    judgeModelId: options.judgeModelId,
  });
}

function addChildBeforeFollowUps(state: TUIState, child: Component): void {
  if (state.followUpComponents.length > 0) {
    const firstFollowUp = state.followUpComponents[0];
    const idx = state.chatContainer.children.indexOf(firstFollowUp as never);
    if (idx >= 0) {
      (state.chatContainer.children as unknown[]).splice(idx, 0, child);
      state.chatContainer.invalidate();
      return;
    }
  }

  state.chatContainer.addChild(child);
}

export function addChildBeforeMessageOrFollowUps(state: TUIState, child: Component, precedesMessageId?: string): void {
  if (precedesMessageId) {
    const anchor = state.messageComponentsById.get(precedesMessageId);
    if (anchor) {
      const idx = state.chatContainer.children.indexOf(anchor as never);
      if (idx >= 0) {
        (state.chatContainer.children as unknown[]).splice(idx, 0, child);
        state.chatContainer.invalidate();
        return;
      }
    }
  }

  addChildBeforeFollowUps(state, child);
}

/**
 * Add a user message to the chat container.
 */
export function addUserMessage(state: TUIState, message: HarnessMessage): void {
  const reminderPart = message.content.find(
    (content): content is Extract<HarnessMessageContent, { type: 'system_reminder' }> =>
      content.type === 'system_reminder',
  );

  if (reminderPart) {
    const goalMetadata = reminderPart as typeof reminderPart & { goalMaxTurns?: number; judgeModelId?: string };
    const reminderComponent = createReminderComponent(reminderPart.reminderType, {
      message: reminderPart.message,
      path: reminderPart.path,
      gapText: reminderPart.gapText,
      goalMaxTurns: goalMetadata.goalMaxTurns,
      judgeModelId: goalMetadata.judgeModelId,
    });
    reminderComponent.setExpanded(state.toolOutputExpanded);
    state.allSystemReminderComponents.push(reminderComponent);

    addChildBeforeMessageOrFollowUps(state, reminderComponent, reminderPart.precedesMessageId);
    state.ui.requestRender();
    return;
  }

  const textContent = message.content
    .filter(c => c.type === 'text')
    .map(c => (c as { type: 'text'; text: string }).text)
    .join('\n');

  const imageCount = message.content.filter(c => c.type === 'image').length;

  // Strip [image] markers from text since we show count separately
  const displayText = imageCount > 0 ? textContent.replace(/\[image\]\s*/g, '').trim() : textContent.trim();
  const exactDisplayText = displayText.trim();

  const legacyReminderMatch = exactDisplayText.match(
    /^<system-reminder(?<attrs>\s+[^>]*)?>(?<body>[\s\S]*?)<\/system-reminder>$/,
  );
  if (legacyReminderMatch?.groups?.body) {
    const attrs = legacyReminderMatch.groups.attrs ?? '';
    const reminderType = attrs.match(/\stype="([^"]+)"/)?.[1];
    const path = attrs.match(/\spath="([^"]+)"/)?.[1];
    const precedesMessageId = attrs.match(/\sprecedesMessageId="([^"]+)"/)?.[1];
    const reminderText = unescapeSystemReminderText(legacyReminderMatch.groups.body.trim());
    const reminderComponent = createReminderComponent(reminderType, {
      message: reminderText,
      path,
      gapText: reminderType === 'temporal-gap' ? reminderText.split(' — ')[0]?.trim() : undefined,
    });
    reminderComponent.setExpanded(state.toolOutputExpanded);
    state.allSystemReminderComponents.push(reminderComponent);

    addChildBeforeMessageOrFollowUps(state, reminderComponent, precedesMessageId);
    state.ui.requestRender();
    return;
  }

  // Check for persisted slash command tags.
  const slashCommandMatch = exactDisplayText.match(/^<slash-command\s+name="([^"]*)">([\s\S]*?)<\/slash-command>$/);
  if (slashCommandMatch) {
    const commandName = slashCommandMatch[1]!;
    const commandContent = slashCommandMatch[2]!.trim();
    const slashComp = new SlashCommandComponent(commandName, commandContent);
    state.allSlashCommandComponents.push(slashComp);
    state.chatContainer.addChild(slashComp);
    state.ui.requestRender();
    return;
  }

  const prefix = imageCount > 0 ? `[${imageCount} image${imageCount > 1 ? 's' : ''}] ` : '';
  if (displayText || prefix) {
    const userComponent = new UserMessageComponent(prefix + displayText);

    state.messageComponentsById.set(message.id, userComponent);

    // Always append to end — follow-ups should stay at the bottom
    state.chatContainer.addChild(userComponent);

    // Track follow-up components sent while streaming so tool calls
    // can be inserted before them (keeping them anchored at bottom).
    // Only track if the agent is already streaming a response — otherwise
    // this is the initial message that triggers the response, not a follow-up.
    if (state.harness.getDisplayState().isRunning && state.streamingComponent) {
      state.followUpComponents.push(userComponent);
    }
  }
}

// =============================================================================
// renderExistingMessages
// =============================================================================

/**
 * Re-render all existing messages from the harness thread into the chat container.
 * Called on thread switch and initial load.
 */
export async function renderExistingMessages(state: TUIState): Promise<void> {
  const messages = await state.harness.listMessages({ limit: 40 });

  state.chatContainer.clear();
  state.pendingTools.clear();
  state.allToolComponents = [];
  state.allSlashCommandComponents = [];
  state.allSystemReminderComponents = [];
  state.messageComponentsById.clear();
  state.allShellComponents = [];

  // Local accumulator for detecting task clears during history reconstruction
  let previousTasksAcc: TaskItem[] = [];

  for (const message of messages) {
    if (message.role === 'user') {
      addUserMessage(state, message);
    } else if (message.role === 'assistant') {
      // Render content in order - interleaving text and tool calls
      // Accumulate text/thinking until we hit a tool call, then render both
      let accumulatedContent: HarnessMessageContent[] = [];

      for (const content of message.content) {
        if (content.type === 'text' || content.type === 'thinking') {
          accumulatedContent.push(content);
        } else if (content.type === 'tool_call') {
          // Render accumulated text first if any
          if (accumulatedContent.length > 0) {
            const textMessage: HarnessMessage = {
              ...message,
              content: accumulatedContent,
            };
            const textComponent = new AssistantMessageComponent(
              textMessage,
              state.hideThinkingBlock,
              getMarkdownTheme(),
            );
            state.chatContainer.addChild(textComponent);
            accumulatedContent = [];
          }

          // Find matching tool result
          const toolResult = message.content.find(c => c.type === 'tool_result' && c.id === content.id);

          // Render subagent tool calls with dedicated component
          if (content.name === 'subagent') {
            const subArgs = content.args as
              | {
                  agentType?: string;
                  task?: string;
                  modelId?: string;
                  forked?: boolean;
                }
              | undefined;
            const rawResult = toolResult?.type === 'tool_result' ? formatToolResult(toolResult.result) : undefined;
            const isErr = toolResult?.type === 'tool_result' && toolResult.isError;

            // Parse embedded metadata for model ID, duration, tool calls
            const meta = rawResult ? parseSubagentMeta(rawResult) : null;
            const resultText = meta?.text ?? rawResult;
            const currentModelId =
              typeof (state.harness as { getFullModelId?: () => string }).getFullModelId === 'function'
                ? (state.harness as { getFullModelId: () => string }).getFullModelId()
                : undefined;
            const modelId = meta?.modelId ?? subArgs?.modelId ?? (subArgs?.forked ? currentModelId : undefined);
            const durationMs = meta?.durationMs ?? 0;

            const subComponent = new SubagentExecutionComponent(
              subArgs?.agentType ?? 'unknown',
              subArgs?.task ?? '',
              state.ui,
              modelId,
              { collapseOnComplete: state.quietMode, forked: subArgs?.forked },
            );
            // Populate tool calls from metadata
            if (meta?.toolCalls) {
              for (const tc of meta.toolCalls) {
                subComponent.addToolStart(tc.name, {});
                subComponent.addToolEnd(tc.name, '', tc.isError);
              }
            }
            // Mark as finished with result
            subComponent.finish(isErr ?? false, durationMs, resultText);
            state.chatContainer.addChild(subComponent);
            state.allToolComponents.push(subComponent as any);
            continue;
          }

          // Render ask_user with the proper question component
          if (content.name === 'ask_user' && toolResult?.type === 'tool_result') {
            const askArgs = content.args as
              | { question?: string; options?: Array<{ label: string; description?: string }> }
              | undefined;
            const answer =
              typeof toolResult.result === 'string' ? toolResult.result : formatToolResult(toolResult.result);
            const cancelled = answer === '(skipped)';
            if (askArgs?.question) {
              const askComponent = AskQuestionInlineComponent.fromHistory(
                askArgs.question,
                askArgs.options,
                answer,
                cancelled,
              );
              state.chatContainer.addChild(askComponent);
              continue;
            }
          }

          // Render the tool call
          const toolComponent = new ToolExecutionComponentEnhanced(
            content.name,
            content.args,
            {
              showImages: false,
              collapsedByDefault: !state.toolOutputExpanded,
            },
            state.ui,
          );

          if (toolResult && toolResult.type === 'tool_result') {
            toolComponent.updateResult(
              {
                content: [
                  {
                    type: 'text',
                    text: formatToolResult(toolResult.result),
                  },
                ],
                isError: toolResult.isError,
              },
              false,
            );
          }

          // If this was task_write with all completed or cleared, show inline instead of tool component
          let replacedWithInline = false;
          if (content.name === 'task_write' && toolResult?.type === 'tool_result' && !toolResult.isError) {
            const args = content.args as { tasks?: TaskItem[] } | undefined;
            const tasks = args?.tasks;
            if (tasks && tasks.length > 0 && tasks.every(t => t.status === 'completed')) {
              renderCompletedTasksInline(state, tasks);
              replacedWithInline = true;
            } else if (!tasks || tasks.length === 0) {
              // Tasks were cleared - show with previous tasks if we have them
              if (previousTasksAcc.length > 0) {
                renderClearedTasksInline(state, previousTasksAcc);
                previousTasksAcc = [];
                replacedWithInline = true;
              }
            } else {
              // Track for detecting clears
              previousTasksAcc = [...tasks];
            }
          }

          // If this was submit_plan, show the plan with approval status
          if (content.name === 'submit_plan' && toolResult?.type === 'tool_result') {
            const args = content.args as { title?: string; plan?: string } | undefined;
            // Result could be a string or an object with content property
            let resultText = '';
            if (typeof toolResult.result === 'string') {
              resultText = toolResult.result;
            } else if (
              typeof toolResult.result === 'object' &&
              toolResult.result !== null &&
              'content' in toolResult.result &&
              typeof (toolResult.result as any).content === 'string'
            ) {
              resultText = (toolResult.result as any).content;
            }
            const isApproved = resultText.toLowerCase().includes('approved');
            // Extract feedback if rejected with feedback
            let feedback: string | undefined;
            if (!isApproved && resultText.includes('Feedback:')) {
              const feedbackMatch = resultText.match(/Feedback:\s*(.+)/);
              feedback = feedbackMatch?.[1];
            }

            if (args?.title && args?.plan) {
              const planResult = new PlanResultComponent({
                title: args.title,
                plan: args.plan,
                isApproved,
                feedback,
              });
              state.chatContainer.addChild(planResult);
              replacedWithInline = true;
            }
          }

          if (!replacedWithInline) {
            state.chatContainer.addChild(toolComponent);
            state.allToolComponents.push(toolComponent);
          }
        } else if (
          content.type === 'om_observation_start' ||
          content.type === 'om_observation_end' ||
          content.type === 'om_observation_failed'
        ) {
          // Skip start markers in history — only show completed/failed results
          if (content.type === 'om_observation_start') continue;

          // Render accumulated text first if any
          if (accumulatedContent.length > 0) {
            const textMessage: HarnessMessage = {
              ...message,
              content: accumulatedContent,
            };
            const textComponent = new AssistantMessageComponent(
              textMessage,
              state.hideThinkingBlock,
              getMarkdownTheme(),
            );
            state.chatContainer.addChild(textComponent);
            accumulatedContent = [];
          }

          if (content.type === 'om_observation_end') {
            // Render bordered output box with marker info in footer
            const isReflection = content.operationType === 'reflection';
            const outputComponent = new OMOutputComponent({
              type: isReflection ? 'reflection' : 'observation',
              observations: content.observations ?? '',
              currentTask: content.currentTask,
              suggestedResponse: content.suggestedResponse,
              durationMs: content.durationMs,
              tokensObserved: content.tokensObserved,
              observationTokens: content.observationTokens,
              compressedTokens: isReflection ? content.observationTokens : undefined,
            });
            state.chatContainer.addChild(outputComponent);
          } else {
            // Failed marker
            state.chatContainer.addChild(new OMMarkerComponent(content));
          }
        } else if (content.type === 'om_thread_title_updated') {
          // Render thread title update marker in history
          state.chatContainer.addChild(
            new OMMarkerComponent({
              type: 'om_thread_title_updated',
              newTitle: content.newTitle,
              oldTitle: content.oldTitle,
            }),
          );
        }
        // Skip tool_result - it's handled with tool_call above
      }

      // Render any remaining text after the last tool call
      if (accumulatedContent.length > 0) {
        const textMessage: HarnessMessage = {
          ...message,
          content: accumulatedContent,
        };
        const textComponent = new AssistantMessageComponent(textMessage, state.hideThinkingBlock, getMarkdownTheme());
        state.chatContainer.addChild(textComponent);
      }
    }
  }

  // Restore pinned task list from the last active task_write in history
  if (previousTasksAcc.length > 0 && state.taskProgress) {
    state.taskProgress.updateTasks(previousTasksAcc);
  }

  state.ui.requestRender();
}

function unescapeSystemReminderText(text: string): string {
  return text.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
}
