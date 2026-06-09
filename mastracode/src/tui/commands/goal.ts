/**
 * /goal command — persistent cross-turn goals (Ralph loop).
 *
 * Usage:
 *   /goal <text>      Set a standing goal (asks for judge defaults only if unset)
 *   /goal             Open goal actions
 *   /goal status      Show current goal status
 *   /goal pause       Pause the continuation loop
 *   /goal resume      Resume without resetting the turn counter
 *   /goal clear       Drop the goal
 *   /judge            Set global judge model and max-attempt defaults
 */
import { Box, SelectList, Spacer, Text } from '@mariozechner/pi-tui';
import type { SelectItem } from '@mariozechner/pi-tui';
import type { HarnessMessage } from '@mastra/core/harness';
import { loadSettings, saveSettings } from '../../onboarding/settings.js';
import { GoalCyclesDialogComponent } from '../components/goal-cycles-dialog.js';
import { JudgeDisplayComponent } from '../components/judge-display.js';
import { ModelSelectorComponent } from '../components/model-selector.js';
import type { ModelItem } from '../components/model-selector.js';
import { GradientAnimator } from '../components/obi-loader.js';
import { DEFAULT_MAX_TURNS } from '../goal-manager.js';
import type { GoalState } from '../goal-manager.js';
import { showModalOverlay } from '../overlay.js';
import { promptForApiKeyIfNeeded } from '../prompt-api-key.js';
import { getSelectListTheme, theme } from '../theme.js';

import type { SlashCommandContext } from './types.js';

export interface StartGoalOptions {
  trigger?: 'send' | 'none';
}

export async function handleGoalCommand(ctx: SlashCommandContext, args: string[]): Promise<void> {
  const { state } = ctx;
  const goalManager = state.goalManager;
  const subCommand = args[0]?.toLowerCase();

  if (!subCommand) {
    await showGoalActionModal(ctx);
    return;
  }

  // /goal status — show current state
  if (subCommand === 'status') {
    showGoalStatus(ctx);
    return;
  }

  // /goal pause
  if (subCommand === 'pause') {
    const goal = goalManager.pause();
    if (!goal) {
      ctx.showInfo('No goal to pause.');
      return;
    }
    await goalManager.saveToThread(state);
    ctx.showInfo(
      `Goal paused: "${goal.objective}" (${goal.turnsUsed}/${goal.maxTurns} turns used). Use /goal resume to continue.`,
    );
    return;
  }

  // /goal resume
  if (subCommand === 'resume') {
    const goal = goalManager.getGoal();
    if (!goal) {
      ctx.showInfo('No goal to resume. Use /goal <text> to set one.');
      return;
    }
    if (goal.status === 'active') {
      ctx.showInfo('Goal is already active.');
      return;
    }
    if (goal.status !== 'paused') {
      ctx.showInfo('Goal is already done. Use /goal <text> to set a new goal.');
      return;
    }

    const wasJudgeFailure = goal.lastPauseWasJudgeFailure;
    goalManager.resume();
    await goalManager.saveToThread(state);

    if (wasJudgeFailure) {
      // The goal was paused because the judge failed — retrigger the judge
      // evaluation instead of prompting the main agent.
      ctx.showInfo(`Goal resumed: "${goal.objective}" — retriggering judge evaluation...`);
      triggerGoalJudge(ctx, { requireAssistantMessage: true });
      return;
    }

    ctx.showInfo(
      `Goal resumed: "${goal.objective}" — ${goal.turnsUsed}/${goal.maxTurns} turns used. Sending continuation...`,
    );

    // Kick off the next turn
    try {
      await state.harness.sendMessage({ content: `Continue working toward the goal: ${goal.objective}` });
    } catch (err) {
      goalManager.pause();
      await goalManager.saveToThread(state);
      ctx.showError(
        `Goal paused — failed to send continuation for "${goal.objective}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return;
  }

  // /goal clear
  if (subCommand === 'clear') {
    goalManager.clear();
    state.planStartedGoalId = undefined;
    await goalManager.saveToThread(state);
    ctx.showInfo('Goal cleared.');
    return;
  }

  // /goal <text> — set a new goal using saved judge defaults, asking only once if needed.
  const objective = args.join(' ');
  await startGoalWithDefaults(ctx, objective);
}

function formatGoalStatus(goal: GoalState): string {
  return `Goal (${goal.status}): "${goal.objective}" — ${goal.turnsUsed}/${goal.maxTurns} turns used [judge: ${goal.judgeModelId}]`;
}

function formatGoalStatusRow(goal: GoalState): string {
  return formatGoalStatus(goal).replace(/\s+/g, ' ');
}

function showGoalStatus(ctx: SlashCommandContext): void {
  const goal = ctx.state.goalManager.getGoal();
  if (!goal) {
    ctx.showInfo('No goal set. Use /goal <text> to set one.');
    return;
  }
  ctx.showInfo(formatGoalStatus(goal));
}

async function showGoalActionModal(ctx: SlashCommandContext): Promise<void> {
  const goal = ctx.state.goalManager.getGoal();
  const items: SelectItem[] = [
    {
      value: 'status',
      label: `  Status  ${theme.fg('dim', goal ? formatGoalStatusRow(goal) : 'No goal set')}`,
    },
  ];

  if (goal?.status === 'active') {
    items.push({ value: 'pause', label: `  Pause  ${theme.fg('dim', 'Pause the continuation loop')}` });
  } else if (goal?.status === 'paused') {
    items.push({ value: 'resume', label: `  Resume  ${theme.fg('dim', 'Resume and send a continuation')}` });
  }

  if (goal) {
    items.push({ value: 'clear', label: `  Clear  ${theme.fg('dim', 'Drop the current goal')}` });
  }

  items.push(
    { value: 'judge', label: `  Judge settings  ${theme.fg('dim', 'Set judge model and max attempts')}` },
    { value: 'new-hint', label: `  New goal  ${theme.fg('dim', 'Type /goal <objective> to start')}` },
  );

  return new Promise<void>(resolve => {
    const container = new Box(4, 2, (text: string) => theme.bg('overlayBg', text));
    container.addChild(new Text(theme.bold(theme.fg('accent', 'Goal Actions')), 0, 0));
    container.addChild(new Spacer(1));

    const selectList = new SelectList(items, items.length, getSelectListTheme());
    selectList.onSelect = async (item: SelectItem) => {
      ctx.state.ui.hideOverlay();
      try {
        if (item.value === 'status') showGoalStatus(ctx);
        else if (item.value === 'pause') await handleGoalCommand(ctx, ['pause']);
        else if (item.value === 'resume') await handleGoalCommand(ctx, ['resume']);
        else if (item.value === 'clear') await handleGoalCommand(ctx, ['clear']);
        else if (item.value === 'judge') await handleJudgeCommand(ctx);
        else if (item.value === 'new-hint') ctx.showInfo('Type /goal <objective> to start a new goal.');
      } finally {
        resolve();
      }
    };

    selectList.onCancel = () => {
      ctx.state.ui.hideOverlay();
      resolve();
    };

    container.addChild(selectList);
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg('dim', '↑↓ navigate · Enter select · Esc cancel'), 0, 0));

    const modal = container as Box & { handleInput: (data: string) => void };
    modal.handleInput = (data: string) => selectList.handleInput(data);
    showModalOverlay(ctx.state.ui, modal, { maxHeight: '60%' });
  });
}

export async function handleJudgeCommand(ctx: SlashCommandContext): Promise<void> {
  const defaults = await promptForJudgeDefaults(ctx, 'Judge settings unchanged.');
  if (!defaults) return;

  const activeGoal = ctx.state.goalManager.updateJudgeDefaults(defaults.judgeModelId, defaults.maxTurns);
  if (activeGoal) {
    await ctx.state.goalManager.saveToThread(ctx.state);
    ctx.showInfo(
      `Judge defaults set: ${defaults.judgeModelId}, ${defaults.maxTurns} max attempts. Current goal updated.`,
    );
    return;
  }

  ctx.showInfo(`Judge defaults set: ${defaults.judgeModelId}, ${defaults.maxTurns} max attempts.`);
}

interface JudgeDefaults {
  judgeModelId: string;
  maxTurns: number;
}

export async function startGoalWithDefaults(
  ctx: SlashCommandContext,
  objective: string,
  cancelMessage = 'Goal cancelled.',
  options: StartGoalOptions = {},
): Promise<void> {
  const defaults = getJudgeDefaults();
  const judgeDefaults = defaults ?? (await promptForJudgeDefaults(ctx, cancelMessage));
  if (!judgeDefaults) return;

  await startGoal(ctx, objective, judgeDefaults.judgeModelId, judgeDefaults.maxTurns, options);
}

function getJudgeDefaults(): JudgeDefaults | null {
  const settings = loadSettings();
  const judgeModelId = settings.models.goalJudgeModel;
  const maxTurns = settings.models.goalMaxTurns;
  if (!judgeModelId || typeof maxTurns !== 'number' || maxTurns <= 0) return null;
  return { judgeModelId, maxTurns };
}

async function promptForJudgeDefaults(ctx: SlashCommandContext, cancelMessage: string): Promise<JudgeDefaults | null> {
  const { state } = ctx;
  const availableModels = await state.harness.listAvailableModels();

  if (availableModels.length === 0) {
    ctx.showError('No models available. Cannot set goal judge defaults.');
    return null;
  }

  const settings = loadSettings();
  const preselectedId = settings.models.goalJudgeModel ?? state.harness.getCurrentModelId() ?? undefined;
  const defaultMaxTurns =
    typeof settings.models.goalMaxTurns === 'number' && settings.models.goalMaxTurns > 0
      ? settings.models.goalMaxTurns
      : DEFAULT_MAX_TURNS;

  return new Promise(resolve => {
    const selector = new ModelSelectorComponent({
      tui: state.ui,
      models: availableModels,
      currentModelId: preselectedId,
      title: 'Select Goal Judge Model',
      onSelect: async (model: ModelItem) => {
        state.ui.hideOverlay();
        await promptForApiKeyIfNeeded(state.ui, model, ctx.authStorage);

        const cyclesDialog = new GoalCyclesDialogComponent({
          defaultValue: defaultMaxTurns,
          onSubmit: (maxTurns: number) => {
            state.ui.hideOverlay();
            const s = loadSettings();
            s.models.goalJudgeModel = model.id;
            s.models.goalMaxTurns = maxTurns;
            saveSettings(s);
            resolve({ judgeModelId: model.id, maxTurns });
          },
          onCancel: () => {
            state.ui.hideOverlay();
            ctx.showInfo(cancelMessage);
            resolve(null);
          },
        });

        state.ui.showOverlay(cyclesDialog, {
          width: '50%',
          maxHeight: '40%',
          anchor: 'center',
        });
        cyclesDialog.focused = true;
      },
      onCancel: () => {
        state.ui.hideOverlay();
        ctx.showInfo(cancelMessage);
        resolve(null);
      },
    });

    state.ui.showOverlay(selector, {
      width: '80%',
      maxHeight: '60%',
      anchor: 'center',
    });
    selector.focused = true;
  });
}

/**
 * Trigger a goal judge evaluation from the command context (e.g. after /goal resume
 * following a judge failure). Mirrors the UI setup from maybeGoalContinuation in
 * agent-lifecycle.ts but skips queue draining since there's no agent turn to follow up.
 */
function triggerGoalJudge(ctx: SlashCommandContext, options: { requireAssistantMessage?: boolean } = {}): void {
  const { state } = ctx;
  const goal = state.goalManager.getGoal();
  if (!goal) return;
  const evaluatedGoalId = goal.id;

  if (!state.gradientAnimator) {
    state.gradientAnimator = new GradientAnimator(() => {
      ctx.updateStatusLine();
    });
  }
  const abortController = new AbortController();
  const judgeComponent = new JudgeDisplayComponent(null, goal.turnsUsed, goal.maxTurns);
  const activeGoalJudge = { modelId: goal.judgeModelId, abortController, component: judgeComponent };
  state.activeGoalJudge = activeGoalJudge;
  state.chatContainer.addChild(judgeComponent);
  state.gradientAnimator.start();
  ctx.updateStatusLine();
  state.ui.requestRender();

  state.goalManager
    .evaluateAfterTurn(state, {
      abortSignal: abortController.signal,
      requireAssistantMessage: options.requireAssistantMessage,
      onActivity: line => {
        if (state.activeGoalJudge === activeGoalJudge) {
          judgeComponent.addActivity(line);
          state.ui.requestRender();
        }
      },
    })
    .then(async ({ continuation, judgeResult }) => {
      if (state.activeGoalJudge !== activeGoalJudge) return;

      const currentGoal = state.goalManager.getGoal();
      if (!currentGoal || currentGoal.id !== evaluatedGoalId) return;

      if (judgeResult) {
        judgeComponent.setResult(judgeResult, currentGoal.turnsUsed, currentGoal.maxTurns);
        state.ui.requestRender();
      }

      if (abortController.signal.aborted) {
        state.userInitiatedAbort = false;
        return;
      }

      if (continuation) {
        if (currentGoal.status !== 'active') return;
        try {
          await state.harness.sendSignal({
            type: 'system-reminder',
            contents: continuation,
            attributes: { type: 'goal-judge' },
            metadata: {
              goalId: currentGoal.id,
              turnsUsed: currentGoal.turnsUsed,
              maxTurns: currentGoal.maxTurns,
              judgeModelId: currentGoal.judgeModelId,
            },
          }).accepted;
        } catch (error) {
          state.goalManager.pause();
          await state.goalManager.saveToThread(state);
          ctx.showError(`Failed to send goal continuation: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        // Persist the final judge response so the conversation history survives reloads.
        if (judgeResult) {
          const harness = state.harness as typeof state.harness & {
            saveSystemReminderMessage?: (args: { reminderType: string; message: string }) => Promise<unknown>;
          };
          try {
            await harness.saveSystemReminderMessage?.({
              reminderType: 'goal-judge',
              message: `${judgeResult.decision} (${currentGoal.turnsUsed}/${currentGoal.maxTurns})\n${judgeResult.reason}`,
            });
          } catch (error) {
            ctx.showError(
              `Failed to persist goal judge result: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
        if (currentGoal.status === 'paused') {
          ctx.showInfo(
            `Goal paused (attempt ${currentGoal.turnsUsed}/${currentGoal.maxTurns}). Use /goal resume to continue.`,
          );
        }

        if (judgeResult?.decision === 'done' && currentGoal.id === state.planStartedGoalId) {
          const goalId = state.planStartedGoalId;
          state.planStartedGoalId = undefined;
          try {
            await state.harness.switchMode({ modeId: 'plan' });
          } catch (error) {
            ctx.showError(`Failed to switch to Plan mode: ${error instanceof Error ? error.message : String(error)}`);
            state.planStartedGoalId = goalId;
          }
        }
      }
    })
    .catch(() => {
      // Goal evaluation failed — don't block the TUI
    })
    .finally(() => {
      if (state.activeGoalJudge === activeGoalJudge) {
        state.activeGoalJudge = undefined;
      }
      state.gradientAnimator?.fadeOut();
      ctx.updateStatusLine();
      state.ui.requestRender();
    });
}

async function startGoal(
  ctx: SlashCommandContext,
  objective: string,
  judgeModelId: string,
  maxTurns: number,
  options: StartGoalOptions = {},
): Promise<void> {
  const { state } = ctx;
  const goalManager = state.goalManager;

  if (state.pendingNewThread) {
    await state.harness.createThread();
    state.pendingNewThread = false;
  }

  const shouldPersistToCreatedThread = !state.harness.getCurrentThreadId();
  const goal = goalManager.setGoal(objective, judgeModelId, maxTurns);

  state.planStartedGoalId = undefined;
  if (options.trigger === 'none') {
    goal.activeStartedAt = undefined;
    goal.activeDurationMs = 0;
  }
  if (shouldPersistToCreatedThread) {
    goalManager.persistOnNextThreadCreate();
  }
  await goalManager.saveToThread(state);

  if (options.trigger === 'none') {
    return;
  }

  try {
    await state.harness.sendSignal(createGoalReminderSignal(goal)).accepted;
  } catch (err) {
    goalManager.pause();
    await goalManager.saveToThread(state);
    ctx.showError(`Goal paused — failed to start: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function createGoalReminderSignal(goal: GoalState) {
  return {
    type: 'system-reminder' as const,
    contents: goal.objective,
    attributes: { type: 'goal' },
    metadata: {
      goalId: goal.id,
      maxTurns: goal.maxTurns,
      judgeModelId: goal.judgeModelId,
    },
  };
}

export function createGoalReminderMessage(
  goalId: string,
  objective: string,
  maxTurns: number,
  judgeModelId: string,
): HarnessMessage {
  return {
    id: `goal-${goalId}`,
    role: 'user',
    createdAt: new Date(),
    content: [
      {
        type: 'system_reminder',
        reminderType: 'goal',
        message: objective,
        goalMaxTurns: maxTurns,
        judgeModelId,
      },
    ],
  } as unknown as HarnessMessage;
}

export function createGoalReminderXml(message: string): string {
  return `<system-reminder type="goal">${escapeXml(message)}</system-reminder>`;
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
