import { showInfo } from './display.js';
import type { TUIState } from './state.js';

export const GOAL_JUDGE_INPUT_LOCK_MESSAGE = 'Goal judge is evaluating; wait a moment or press Esc to pause the goal.';

export function isGoalJudgeInputLocked(state: TUIState): boolean {
  return Boolean(state.activeGoalJudge);
}

export function showGoalJudgeInputLockInfo(state: TUIState): void {
  showInfo(state, GOAL_JUDGE_INPUT_LOCK_MESSAGE);
}

export function canRunSlashCommandDuringGoalJudge(command: string, args: string[]): boolean {
  if (command === 'exit') return true;
  if (command !== 'goal') return false;
  return args[0] === 'pause' || args[0] === 'clear';
}
