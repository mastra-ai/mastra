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
 *   /goal judge       Set the goal judge model and max-attempt defaults
 */
import { Box, SelectList, Spacer, Text } from '@earendil-works/pi-tui';
import type { SelectItem } from '@earendil-works/pi-tui';
import { createGoalReminderSignal } from '@mastra/code-sdk/goal-signal';
import { loadSettings, saveSettings } from '@mastra/code-sdk/onboarding/settings';
import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { createSignal } from '@mastra/core/signals';
import { GoalCyclesDialogComponent } from '../components/goal-cycles-dialog.js';
import { ModelSelectorComponent } from '../components/model-selector.js';
import type { ModelItem } from '../components/model-selector.js';
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
    ctx.updateStatusLine();
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
    ctx.updateStatusLine();

    // Kick off the next turn using the same goal-reminder signal format used by
    // startGoal, so the model receives a structured system-reminder rather than
    // a plain user message.
    const resumedGoal = goalManager.getGoal();
    try {
      await state.session.sendSignal(createGoalReminderSignal(resumedGoal!)).accepted;
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
    // Abort any in-flight turn. The cleared objective stops the core loop from
    // driving *new* goal continuations, but a turn that was already running when
    // the user cleared keeps going to completion — which reads as "it's still
    // attempting the goal". Stop it immediately so clear means stop. Mirrors the
    // Esc/abort cleanup so a turn parked in a tool suspension (e.g. ask_user) is
    // also aborted cleanly.
    if (state.session.run.isRunning() || state.session.suspensions.hasPending()) {
      state.activeInlineQuestion = undefined;
      state.pendingInlineQuestions.length = 0;
      state.pendingAskUserComponents?.clear();
      state.userInitiatedAbort = true;
      state.session.abort();
    }
    ctx.updateStatusLine();
    ctx.showInfo('Goal cleared.');
    return;
  }

  // /goal judge — set the judge model and max-attempt defaults
  if (subCommand === 'judge') {
    await handleJudgeCommand(ctx);
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

  const activeGoal = await ctx.state.goalManager.updateJudgeDefaults(
    ctx.state,
    defaults.judgeModelId,
    defaults.maxTurns,
  );
  if (activeGoal) {
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
  const availableModels = await state.controller.listAvailableModels();

  if (availableModels.length === 0) {
    ctx.showError('No models available. Cannot set goal judge defaults.');
    return null;
  }

  const settings = loadSettings();
  const preselectedId = settings.models.goalJudgeModel ?? state.session.model.get() ?? undefined;
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
  options: StartGoalOptions = {},
): Promise<void> {
  const { state } = ctx;
  const goalManager = state.goalManager;

  if (state.pendingNewThread) {
    await state.session.thread.create();
    state.pendingNewThread = false;
  }

  const shouldPersistToCreatedThread = !state.session.thread.getId();
  const goal = await goalManager.setGoal(state, objective, judgeModelId, maxTurns);
  if (!goal) {
    ctx.showError('Failed to set goal.');
    return;
  }

  state.planStartedGoalId = undefined;
  if (options.trigger === 'none') {
    // Plan-started goals don't begin accruing active time until the user
    // actually triggers them.
    goalManager.resetActiveTimer();
  }
  if (shouldPersistToCreatedThread) {
    goalManager.persistOnNextThreadCreate();
  }
  await goalManager.saveToThread(state);
  ctx.updateStatusLine();

  if (options.trigger === 'none') {
    return;
  }

  try {
    await state.session.sendSignal(createGoalReminderSignal(goal)).accepted;
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
): MastraDBMessage {
  return createSignal({
    id: `goal-${goalId}`,
    type: 'reactive',
    tagName: 'system-reminder',
    contents: objective,
    attributes: { type: 'goal' },
    metadata: { goalMaxTurns: maxTurns, judgeModelId },
  } as Parameters<typeof createSignal>[0]).toDBMessage();
}

export function createGoalReminderXml(message: string): string {
  return `<system-reminder type="goal">${escapeXml(message)}</system-reminder>`;
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
