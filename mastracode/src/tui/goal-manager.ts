/**
 * GoalManager — persistent cross-turn goals (Ralph loop).
 *
 * When a goal is active, after each completed agent turn the manager calls
 * a lightweight judge to check whether the objective has been satisfied.
 * If not, a continuation prompt is fed back as a user message automatically.
 *
 * Inspired by Hermes /goal and Codex /goal (Ralph loop pattern).
 */
import { generateText } from 'ai';
import type { LanguageModel } from 'ai';

import { resolveModel } from '../agents/model.js';

import type { TUIState } from './state.js';

// =============================================================================
// Types
// =============================================================================

export type GoalStatus = 'active' | 'paused' | 'done';

export interface GoalState {
  objective: string;
  status: GoalStatus;
  turnsUsed: number;
  maxTurns: number;
}

export interface GoalJudgeResult {
  decision: 'done' | 'continue';
  reason: string;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_TURNS = 20;

const JUDGE_SYSTEM_PROMPT = `You are a goal completion judge. You evaluate whether an AI assistant has achieved a stated goal based on its most recent response.

You MUST respond with exactly one of these two words on the first line: "done" or "continue"
Then on the second line, provide a brief reason (one sentence).

Rules:
- Say "done" ONLY if the goal has been clearly and fully achieved based on the assistant's last response.
- Say "continue" if the goal is partially done, in progress, or not yet addressed.
- When in doubt, say "continue".
- Do not be overly strict — if the assistant has made substantial progress and the remaining work is trivial cleanup, say "done".`;

// Prefer a fast, cheap model for the judge call
const JUDGE_MODEL_PREFERENCES = [
  'anthropic/claude-haiku-4-5',
  'openai/gpt-4o-mini',
  'google/gemini-2.0-flash',
];

// =============================================================================
// GoalManager
// =============================================================================

export class GoalManager {
  private goal: GoalState | null = null;

  getGoal(): GoalState | null {
    return this.goal;
  }

  isActive(): boolean {
    return this.goal?.status === 'active';
  }

  /**
   * Set a new goal objective. Resets turn counter.
   */
  setGoal(objective: string, maxTurns: number = DEFAULT_MAX_TURNS): GoalState {
    this.goal = {
      objective,
      status: 'active',
      turnsUsed: 0,
      maxTurns,
    };
    return this.goal;
  }

  pause(): GoalState | null {
    if (this.goal && this.goal.status === 'active') {
      this.goal.status = 'paused';
    }
    return this.goal;
  }

  resume(): GoalState | null {
    if (this.goal && this.goal.status === 'paused') {
      this.goal.status = 'active';
      this.goal.turnsUsed = 0;
    }
    return this.goal;
  }

  clear(): void {
    this.goal = null;
  }

  markDone(): void {
    if (this.goal) {
      this.goal.status = 'done';
    }
  }

  /**
   * Called after each agent turn completes. Evaluates whether to continue.
   * Returns a continuation prompt if the goal is not yet achieved, or null if done/paused/budget exhausted.
   */
  async evaluateAfterTurn(state: TUIState): Promise<string | null> {
    if (!this.goal || this.goal.status !== 'active') {
      return null;
    }

    this.goal.turnsUsed++;

    // Budget exhaustion
    if (this.goal.turnsUsed >= this.goal.maxTurns) {
      this.goal.status = 'paused';
      return null;
    }

    // Get last assistant message
    const lastAssistantContent = await this.getLastAssistantContent(state);
    if (!lastAssistantContent) {
      // No assistant message to judge — continue anyway
      return this.buildContinuationPrompt('No response yet, keep working.');
    }

    // Call judge
    const result = await this.callJudge(state, lastAssistantContent);

    if (result.decision === 'done') {
      this.goal.status = 'done';
      return null;
    }

    return this.buildContinuationPrompt(result.reason);
  }

  // ===========================================================================
  // Private
  // ===========================================================================

  private async getLastAssistantContent(state: TUIState): Promise<string | null> {
    try {
      const messages = await state.harness.listMessages({ limit: 5 });
      // Find last assistant message
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]!;
        if (msg.role === 'assistant') {
          return this.extractTextContent(msg.content);
        }
      }
    } catch {
      // Fall through
    }
    return null;
  }

  private extractTextContent(content: unknown): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text)
        .join('\n');
    }
    return String(content ?? '');
  }

  private async callJudge(state: TUIState, assistantContent: string): Promise<GoalJudgeResult> {
    try {
      const model = this.resolveJudgeModel(state);
      if (!model) {
        // No model available — fail OPEN (continue)
        return { decision: 'continue', reason: 'No judge model available.' };
      }

      // Truncate very long responses to keep judge calls fast
      const truncated =
        assistantContent.length > 4000 ? assistantContent.slice(0, 4000) + '\n...[truncated]' : assistantContent;

      const { text } = await generateText({
        model,
        system: JUDGE_SYSTEM_PROMPT,
        prompt: `Goal: ${this.goal!.objective}\n\nAssistant's last response:\n${truncated}`,
        maxOutputTokens: 100,
        temperature: 0,
      });

      return this.parseJudgeResponse(text);
    } catch {
      // Judge failure — fail OPEN (continue so progress isn't blocked)
      return { decision: 'continue', reason: 'Judge call failed, continuing.' };
    }
  }

  private resolveJudgeModel(state: TUIState): LanguageModel | null {
    // Try preferred fast models first
    for (const modelId of JUDGE_MODEL_PREFERENCES) {
      try {
        return resolveModel(modelId) as LanguageModel;
      } catch {
        continue;
      }
    }

    // Fall back to current model
    const currentModelId = state.harness.getCurrentModelId();
    if (currentModelId) {
      try {
        return resolveModel(currentModelId) as LanguageModel;
      } catch {
        // Fall through
      }
    }

    return null;
  }

  private parseJudgeResponse(text: string): GoalJudgeResult {
    const lines = text.trim().split('\n');
    const firstLine = (lines[0] ?? '').toLowerCase().trim();
    const reason = lines.slice(1).join(' ').trim() || 'No reason provided.';

    if (firstLine.startsWith('done')) {
      return { decision: 'done', reason };
    }

    // Default to continue (fail OPEN)
    return { decision: 'continue', reason };
  }

  private buildContinuationPrompt(judgeReason: string): string {
    const turn = this.goal!.turnsUsed;
    const max = this.goal!.maxTurns;
    return `Continue working toward the goal. (Turn ${turn}/${max}: ${judgeReason})`;
  }
}
