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
  judgeModelId: string;
}

export interface GoalJudgeResult {
  decision: 'done' | 'continue';
  reason: string;
}

export interface GoalEvaluationResult {
  continuation: string | null;
  judgeResult: GoalJudgeResult | null;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_TURNS = 20;
const THREAD_GOAL_KEY = 'goal';

const JUDGE_SYSTEM_PROMPT = `You are a goal completion judge. Given a goal and the assistant's latest response, reason about whether the goal's requirements have been satisfied.

Think step by step:
1. What does the goal require? Break it into concrete deliverables or success criteria.
2. What has the assistant actually produced or accomplished in this response?
3. Are all requirements met?

Then respond with exactly one of these two words on the FIRST line: "done" or "continue"
On the SECOND line, provide a brief reason explaining what was accomplished or what remains.

Guidelines:
- Focus on the substance of the goal — compare what was asked vs what was delivered.
- If the goal asks for N items and N items have been produced, say "done".
- If the assistant's output satisfies the goal's intent even if phrased differently, say "done".
- Say "continue" with specific feedback about what is still missing or incomplete.
- Your reason on the "continue" line will be sent back to the assistant as guidance, so be specific about what still needs to be done.`;

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
  setGoal(objective: string, judgeModelId: string, maxTurns: number = DEFAULT_MAX_TURNS): GoalState {
    this.goal = {
      objective,
      status: 'active',
      turnsUsed: 0,
      maxTurns,
      judgeModelId,
    };
    return this.goal;
  }

  /**
   * Load goal state from thread metadata (called on thread switch).
   */
  loadFromThreadMetadata(metadata: Record<string, unknown> | undefined): void {
    const saved = metadata?.[THREAD_GOAL_KEY] as GoalState | undefined;
    if (saved && saved.objective && saved.status) {
      this.goal = saved;
    } else {
      this.goal = null;
    }
  }

  /**
   * Persist goal state to thread metadata.
   */
  async saveToThread(state: TUIState): Promise<void> {
    try {
      if (this.goal) {
        await state.harness.setThreadSetting({ key: THREAD_GOAL_KEY, value: this.goal });
      } else {
        await state.harness.setThreadSetting({ key: THREAD_GOAL_KEY, value: undefined });
      }
    } catch {
      // Persistence is not critical
    }
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
   * Returns a GoalEvaluationResult with continuation prompt and judge result.
   */
  async evaluateAfterTurn(state: TUIState): Promise<GoalEvaluationResult> {
    if (!this.goal || this.goal.status !== 'active') {
      return { continuation: null, judgeResult: null };
    }

    this.goal.turnsUsed++;

    // Get last assistant message
    const lastAssistantContent = await this.getLastAssistantContent(state);
    if (!lastAssistantContent) {
      // No assistant message to judge — continue anyway (but check budget)
      if (this.goal.turnsUsed >= this.goal.maxTurns) {
        this.goal.status = 'paused';
        await this.saveToThread(state);
        return { continuation: null, judgeResult: null };
      }
      await this.saveToThread(state);
      return { continuation: this.buildContinuationPrompt('No response yet, keep working.'), judgeResult: null };
    }

    // Call judge — always judge the current turn's response before enforcing budget
    const result = await this.callJudge(lastAssistantContent);

    if (result.decision === 'done') {
      this.goal.status = 'done';
      await this.saveToThread(state);
      return { continuation: null, judgeResult: result };
    }

    // Budget exhaustion (checked after judging so the last turn can still be marked done)
    if (this.goal.turnsUsed >= this.goal.maxTurns) {
      this.goal.status = 'paused';
      await this.saveToThread(state);
      return { continuation: null, judgeResult: result };
    }

    await this.saveToThread(state);
    return { continuation: this.buildContinuationPrompt(result.reason), judgeResult: result };
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

  private async callJudge(assistantContent: string): Promise<GoalJudgeResult> {
    try {
      const model = this.resolveJudgeModel();
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
        maxOutputTokens: 300,
        temperature: 0,
      });

      return this.parseJudgeResponse(text);
    } catch {
      // Judge failure — fail OPEN (continue so progress isn't blocked)
      return { decision: 'continue', reason: 'Judge call failed, continuing.' };
    }
  }

  private resolveJudgeModel(): LanguageModel | null {
    if (!this.goal?.judgeModelId) return null;
    try {
      return resolveModel(this.goal.judgeModelId) as LanguageModel;
    } catch {
      return null;
    }
  }

  private parseJudgeResponse(text: string): GoalJudgeResult {
    const lines = text.trim().split('\n');

    // Scan for the first line that is a decision keyword
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.toLowerCase().trim();
      if (line === 'done' || line.startsWith('done')) {
        const reason =
          lines
            .slice(i + 1)
            .join(' ')
            .trim() || 'Goal completed.';
        return { decision: 'done', reason };
      }
      if (line === 'continue' || line.startsWith('continue')) {
        const reason =
          lines
            .slice(i + 1)
            .join(' ')
            .trim() || 'Continuing.';
        return { decision: 'continue', reason };
      }
    }

    // If no clear decision found, default to continue (fail OPEN)
    return { decision: 'continue', reason: text.trim().split('\n').pop() || 'No clear decision from judge.' };
  }

  private buildContinuationPrompt(judgeReason: string): string {
    const turn = this.goal!.turnsUsed;
    const max = this.goal!.maxTurns;
    return `[Goal attempt ${turn}/${max}] The goal is not yet complete. Judge feedback: ${judgeReason}\n\nContinue working toward the goal: ${this.goal!.objective}`;
  }
}
