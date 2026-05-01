/**
 * /goal command — persistent cross-turn goals (Ralph loop).
 *
 * Usage:
 *   /goal <text>      Set a standing goal and start working toward it
 *   /goal             Show current goal status
 *   /goal status      Show current goal status
 *   /goal pause       Pause the continuation loop
 *   /goal resume      Resume (resets turn counter)
 *   /goal clear       Drop the goal
 */
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
    const statusLine = `Goal (${goal.status}): "${goal.objective}" — ${goal.turnsUsed}/${goal.maxTurns} turns used`;
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
    ctx.showInfo(`Goal paused: "${goal.objective}" (${goal.turnsUsed}/${goal.maxTurns} turns used). Use /goal resume to continue.`);
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
    ctx.showInfo(`Goal resumed: "${goal.objective}" — turn counter reset. Sending continuation...`);

    // Kick off the next turn
    if (state.pendingNewThread) {
      await state.harness.createThread();
      state.pendingNewThread = false;
    }
    state.harness.sendMessage({ content: `Continue working toward the goal: ${goal.objective}` }).catch(() => {});
    return;
  }

  // /goal clear
  if (subCommand === 'clear') {
    goalManager.clear();
    ctx.showInfo('Goal cleared.');
    return;
  }

  // /goal <text> — set a new goal
  const objective = args.join(' ');
  const goal = goalManager.setGoal(objective);
  ctx.showInfo(`Goal set (${goal.maxTurns}-turn budget): "${objective}"`);

  // Kick off the first turn immediately
  if (state.pendingNewThread) {
    await state.harness.createThread();
    state.pendingNewThread = false;
  }
  state.harness.sendMessage({ content: objective }).catch(() => {});
}
