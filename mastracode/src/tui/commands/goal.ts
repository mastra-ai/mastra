/**
 * /goal command — persistent cross-turn goals (Ralph loop).
 *
 * Usage:
 *   /goal <text>      Set a standing goal (asks for judge defaults only if unset)
 *   /goal             Show current goal status
 *   /goal status      Show current goal status
 *   /goal pause       Pause the continuation loop
 *   /goal resume      Resume (resets turn counter)
 *   /goal clear       Drop the goal
 *   /judge            Set global judge model and max-attempt defaults
 */
import type { HarnessMessage } from '@mastra/core/harness';
import { loadSettings, saveSettings } from '../../onboarding/settings.js';
import { GoalCyclesDialogComponent } from '../components/goal-cycles-dialog.js';
import { ModelSelectorComponent } from '../components/model-selector.js';
import type { ModelItem } from '../components/model-selector.js';
import { DEFAULT_MAX_TURNS } from '../goal-manager.js';
import { promptForApiKeyIfNeeded } from '../prompt-api-key.js';

import type { SlashCommandContext } from './types.js';

export async function handleGoalCommand(ctx: SlashCommandContext, args: string[]): Promise<void> {
  const { state } = ctx;
  const goalManager = state.goalManager;
  const subCommand = args[0]?.toLowerCase();

  // /goal (no args) or /goal status — show current state
  if (!subCommand || subCommand === 'status') {
    const goal = goalManager.getGoal();
    if (!goal) {
      ctx.showInfo('No goal set. Use /goal <text> to set one.');
      return;
    }
    const statusLine = `Goal (${goal.status}): "${goal.objective}" — ${goal.turnsUsed}/${goal.maxTurns} turns used [judge: ${goal.judgeModelId}]`;
    ctx.showInfo(statusLine);
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
    goalManager.resume();
    await goalManager.saveToThread(state);
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
    await goalManager.saveToThread(state);
    ctx.showInfo('Goal cleared.');
    return;
  }

  // /goal <text> — set a new goal using saved judge defaults, asking only once if needed.
  const objective = args.join(' ');
  await startGoalWithDefaults(ctx, objective);
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
): Promise<void> {
  const defaults = getJudgeDefaults();
  const judgeDefaults = defaults ?? (await promptForJudgeDefaults(ctx, cancelMessage));
  if (!judgeDefaults) return;

  await startGoal(ctx, objective, judgeDefaults.judgeModelId, judgeDefaults.maxTurns);
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

async function startGoal(
  ctx: SlashCommandContext,
  objective: string,
  judgeModelId: string,
  maxTurns: number,
): Promise<void> {
  const { state } = ctx;
  const goalManager = state.goalManager;

  if (state.pendingNewThread) {
    await state.harness.createThread();
    state.pendingNewThread = false;
  }

  const shouldPersistToCreatedThread = !state.harness.getCurrentThreadId();
  const goal = goalManager.setGoal(objective, judgeModelId, maxTurns);
  if (shouldPersistToCreatedThread) {
    goalManager.persistOnNextThreadCreate();
  }
  await goalManager.saveToThread(state);

  ctx.addUserMessage(createGoalReminderMessage(goal.id, objective, goal.maxTurns, judgeModelId));

  try {
    await state.harness.sendMessage({ content: toSystemReminderXml('goal', objective) });
  } catch (err) {
    goalManager.pause();
    await goalManager.saveToThread(state);
    ctx.showError(`Goal paused — failed to start: ${err instanceof Error ? err.message : String(err)}`);
  }
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

function toSystemReminderXml(type: string, message: string): string {
  return `<system-reminder type="${type}">${escapeXml(message)}</system-reminder>`;
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
