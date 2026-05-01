/**
 * /goal command — persistent cross-turn goals (Ralph loop).
 *
 * Usage:
 *   /goal <text>      Set a standing goal (shows judge model picker)
 *   /goal             Show current goal status
 *   /goal status      Show current goal status
 *   /goal pause       Pause the continuation loop
 *   /goal resume      Resume (resets turn counter)
 *   /goal clear       Drop the goal
 */
import { loadSettings, saveSettings } from '../../onboarding/settings.js';
import { ModelSelectorComponent } from '../components/model-selector.js';
import type { ModelItem } from '../components/model-selector.js';
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
    goalManager.resume();
    await goalManager.saveToThread(state);
    ctx.showInfo(`Goal resumed: "${goal.objective}" — turn counter reset. Sending continuation...`);

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

  // /goal <text> — set a new goal; show judge model picker first
  const objective = args.join(' ');
  const availableModels = await state.harness.listAvailableModels();

  if (availableModels.length === 0) {
    ctx.showError('No models available. Cannot set goal without a judge model.');
    return;
  }

  // Preselect: last judge choice from settings, or current main model
  const settings = loadSettings();
  const lastJudgeModelId = (settings.models as Record<string, unknown>).goalJudgeModel as string | undefined;
  const preselectedId = lastJudgeModelId ?? state.harness.getCurrentModelId() ?? undefined;

  return new Promise(resolve => {
    const selector = new ModelSelectorComponent({
      tui: state.ui,
      models: availableModels,
      currentModelId: preselectedId,
      title: 'Select Judge Model for Goal',
      onSelect: async (model: ModelItem) => {
        state.ui.hideOverlay();
        await promptForApiKeyIfNeeded(state.ui, model, ctx.authStorage);

        // Save judge preference for next time
        const s = loadSettings();
        (s.models as Record<string, unknown>).goalJudgeModel = model.id;
        saveSettings(s);

        // Set the goal
        const goal = goalManager.setGoal(objective, model.id);
        await goalManager.saveToThread(state);
        ctx.showInfo(`Goal set (${goal.maxTurns}-turn budget, judge: ${model.id}): "${objective}"`);

        // Kick off the first turn
        try {
          await state.harness.sendMessage({ content: objective });
        } catch (err) {
          goalManager.pause();
          await goalManager.saveToThread(state);
          ctx.showError(`Goal paused — failed to start: ${err instanceof Error ? err.message : String(err)}`);
        }
        resolve();
      },
      onCancel: () => {
        state.ui.hideOverlay();
        ctx.showInfo('Goal cancelled.');
        resolve();
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
