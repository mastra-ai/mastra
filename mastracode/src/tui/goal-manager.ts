/**
 * GoalManager — persistent cross-turn goals (Ralph loop).
 *
 * When a goal is active, after each completed agent turn the manager calls
 * a lightweight judge to check whether the objective has been satisfied.
 * If not, a continuation prompt is fed back as a user message automatically.
 *
 * Inspired by Hermes /goal and Codex /goal (Ralph loop pattern).
 */
import { randomUUID } from 'node:crypto';
import { Agent } from '@mastra/core/agent';
import type { MastraMemory } from '@mastra/core/memory';
import { PrefillErrorHandler, ProviderHistoryCompat, StreamErrorRetryProcessor } from '@mastra/core/processors';
import { z } from 'zod';

import { resolveModel } from '../agents/model.js';

import type { TUIState } from './state.js';

// =============================================================================
// Types
// =============================================================================

export type GoalStatus = 'active' | 'paused' | 'done';

export interface GoalState {
  id: string;
  objective: string;
  status: GoalStatus;
  turnsUsed: number;
  maxTurns: number;
  judgeModelId: string;
}

export interface GoalJudgeResult {
  decision: 'done' | 'continue' | 'waiting' | 'paused';
  reason: string;
}

export interface GoalEvaluationResult {
  continuation: string | null;
  judgeResult: GoalJudgeResult | null;
}

// =============================================================================
// Constants
// =============================================================================

export const DEFAULT_MAX_TURNS = 50;
const THREAD_GOAL_KEY = 'goal';

const JUDGE_SYSTEM_PROMPT = `You are the goal judge. Your decision directly controls whether the assistant continues working toward the goal.

Given a goal and the assistant's latest response, reason about whether the goal's requirements have been satisfied. Compare what the goal asks for against what the assistant has actually produced. Focus on substance, not phrasing.

Use "done" when the goal is fully achieved.
Use "waiting" only when the goal explicitly requires a user checkpoint, user feedback, human verification, human confirmation, or another external event outside the goal-judge loop before the assistant should continue, and the assistant has correctly stopped at that checkpoint. Do not use "waiting" merely because the assistant asked a question or could benefit from user input.
Use "continue" when the goal is not done and the assistant should keep working autonomously, including when it asked for input that the goal did not explicitly require.
If your previous decision was "waiting" for an explicit user checkpoint, keep choosing "waiting" when the user's latest response asks a question, requests clarification, or otherwise does not satisfy the checkpoint. Do not continue until the required user feedback/confirmation/verification has actually been provided.
If the goal says to wait for the goal judge, judge, evaluator, or you to respond, approve, verify, validate, tell the assistant to continue, or otherwise provide the next signal, treat your own decision as that judge response. Verification can be performed by you unless the goal explicitly says it needs human/user verification. Choose "continue" when the assistant should proceed to the next step. Do not choose "waiting" for judge-controlled checkpoints, because that would mean waiting for yourself.

Your "reason" field is sent back to the assistant as guidance when the goal is not yet done — be specific about what still needs to be accomplished. When choosing "continue", write the reason as an instruction for what the assistant should do next. When choosing "waiting", explain what specific user checkpoint is still outstanding.`;

const judgeSchema = z.object({
  decision: z
    .enum(['done', 'continue', 'waiting'])
    .describe(
      'Whether the goal is done, should continue autonomously, or is at an explicit user checkpoint required by the goal',
    ),
  reason: z.string().describe('Brief explanation of what was accomplished or what remains to be done'),
});

const questionAnswerSchema = z.object({
  answer: z
    .string()
    .describe('The answer to give the assistant. If choices are provided, use exactly one choice label.'),
});

// =============================================================================
// GoalManager
// =============================================================================

export class GoalManager {
  private goal: GoalState | null = null;
  private persistGoalOnNextThreadCreate = false;

  getGoal(): GoalState | null {
    return this.goal;
  }

  isActive(): boolean {
    return this.goal?.status === 'active';
  }

  persistOnNextThreadCreate(): void {
    this.persistGoalOnNextThreadCreate = true;
  }

  consumePersistOnNextThreadCreate(): boolean {
    if (!this.persistGoalOnNextThreadCreate) return false;
    this.persistGoalOnNextThreadCreate = false;
    return true;
  }

  /**
   * Set a new goal objective. Resets turn counter.
   */
  setGoal(objective: string, judgeModelId: string, maxTurns: number = DEFAULT_MAX_TURNS): GoalState {
    this.goal = {
      id: randomUUID(),
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
      this.goal = { ...saved, id: saved.id ?? randomUUID() };
    } else {
      this.goal = null;
    }
    this.persistGoalOnNextThreadCreate = false;
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
    }
    return this.goal;
  }

  updateJudgeDefaults(judgeModelId: string, maxTurns: number): GoalState | null {
    if (this.goal) {
      this.goal.judgeModelId = judgeModelId;
      this.goal.maxTurns = maxTurns;
    }
    return this.goal;
  }

  clear(): void {
    this.goal = null;
    this.persistGoalOnNextThreadCreate = false;
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
  async answerQuestion(
    state: TUIState,
    question: string,
    options?: Array<{ label: string; description?: string }>,
  ): Promise<string> {
    if (!this.goal || this.goal.status !== 'active') {
      return '(skipped)';
    }

    const result = await this.callJudgeForQuestion(state, question, options);
    return result.answer;
  }

  async evaluateAfterTurn(state: TUIState): Promise<GoalEvaluationResult> {
    if (!this.goal || this.goal.status !== 'active') {
      return { continuation: null, judgeResult: null };
    }

    const evaluatedGoalId = this.goal.id;

    // Get recent context, including the latest user message when available.
    const context = await this.getRecentConversationContext(state);
    if (!this.goal || this.goal.id !== evaluatedGoalId || this.goal.status !== 'active') {
      return { continuation: null, judgeResult: null };
    }
    if (!context.lastAssistantContent) {
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
    const result = await this.callJudge(state, {
      lastUserContent: context.lastUserContent,
      assistantStepsSinceLastUser: context.assistantStepsSinceLastUser,
      lastAssistantContent: context.lastAssistantContent,
    });
    if (!this.goal || this.goal.id !== evaluatedGoalId || this.goal.status !== 'active') {
      return { continuation: null, judgeResult: null };
    }
    if (result.decision === 'continue' || result.decision === 'done') {
      this.goal.turnsUsed++;
    }
    if (result.decision === 'paused') {
      this.goal.status = 'paused';
      await this.saveToThread(state);
      return { continuation: null, judgeResult: result };
    }

    if (result.decision === 'done') {
      this.goal.status = 'done';
      await this.saveToThread(state);
      return { continuation: null, judgeResult: result };
    }

    if (result.decision === 'waiting') {
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

  private async getRecentConversationContext(state: TUIState): Promise<{
    lastUserContent: string | null;
    assistantStepsSinceLastUser: number;
    lastAssistantContent: string | null;
  }> {
    try {
      const messages = await state.harness.listMessages();
      let lastUserIndex = -1;
      let lastAssistantContent: string | null = null;

      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]!;
        if (!lastAssistantContent && msg.role === 'assistant') {
          lastAssistantContent = this.extractTextContent(msg.content);
        }
        if (msg.role === 'user') {
          lastUserIndex = i;
          break;
        }
      }

      const lastUserContent = lastUserIndex >= 0 ? this.extractTextContent(messages[lastUserIndex]!.content) : null;
      const assistantStepsSinceLastUser =
        lastUserIndex >= 0 ? messages.slice(lastUserIndex + 1).filter(msg => msg.role === 'assistant').length : 0;

      return { lastUserContent, assistantStepsSinceLastUser, lastAssistantContent };
    } catch {
      return { lastUserContent: null, assistantStepsSinceLastUser: 0, lastAssistantContent: null };
    }
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

  private async callJudgeForQuestion(
    state: TUIState,
    question: string,
    options?: Array<{ label: string; description?: string }>,
  ): Promise<{ answer: string }> {
    try {
      const memory = await this.getJudgeMemory(state);
      const judgeAgent = this.createJudgeAgent(memory);
      if (!judgeAgent) {
        return { answer: '(judge could not answer: Judge model could not be initialized.)' };
      }

      const optionLabels = options?.map(option => option.label) ?? [];
      const optionsText = optionLabels.length
        ? `\n\nAvailable answers (choose exactly one label):\n${options!
            .map(option => `- ${option.label}${option.description ? `: ${option.description}` : ''}`)
            .join('\n')}`
        : '';
      const answerSchema = optionLabels.length
        ? z.object({
            answer: z
              .enum(optionLabels as [string, ...string[]])
              .describe('Exactly one label from the available answers.'),
          })
        : questionAnswerSchema;
      const stream = await judgeAgent.stream(
        `Goal: ${this.goal!.objective}\n\nThe assistant asked a question while goal mode is active. Answer it as the goal judge so the assistant can continue without waiting for the human user. If the question asks for verification, verify it yourself unless the goal explicitly requires human/user verification.\n\nQuestion:\n${question}${optionsText}`,
        {
          ...(memory
            ? { memory: { thread: this.getJudgeThreadId(state), resource: state.harness.getResourceId() } }
            : {}),
          structuredOutput: {
            schema: answerSchema,
          },
        },
      );

      await stream.consumeStream();
      const output = (await stream.getFullOutput()).object as z.infer<typeof questionAnswerSchema> | undefined;
      if (!output?.answer) {
        return { answer: '(judge could not answer: no structured answer returned.)' };
      }
      if (optionLabels.length && !optionLabels.includes(output.answer)) {
        return { answer: `(judge could not answer: returned "${output.answer}" outside available answers.)` };
      }
      return { answer: output.answer };
    } catch (error) {
      return { answer: `(judge could not answer: ${formatError(error)})` };
    }
  }

  private async callJudge(
    state: TUIState,
    context: { lastUserContent: string | null; assistantStepsSinceLastUser: number; lastAssistantContent: string },
  ): Promise<GoalJudgeResult> {
    try {
      const memory = await this.getJudgeMemory(state);
      const judgeAgent = this.createJudgeAgent(memory);
      if (!judgeAgent) {
        return { decision: 'paused', reason: 'Judge model could not be initialized.' };
      }

      // Truncate very long messages to keep judge calls fast
      const truncatedAssistant = truncateForJudge(context.lastAssistantContent);
      const recentUser = context.lastUserContent
        ? `\n\nLatest user message:\n${truncateForJudge(context.lastUserContent)}\n\nAssistant steps since that user message: ${context.assistantStepsSinceLastUser}`
        : '';

      const stream = await judgeAgent.stream(
        `Goal: ${this.goal!.objective}${recentUser}\n\nLatest assistant message:\n${truncatedAssistant}`,
        {
          ...(memory
            ? { memory: { thread: this.getJudgeThreadId(state), resource: state.harness.getResourceId() } }
            : {}),
          structuredOutput: {
            schema: judgeSchema,
          },
        },
      );

      await stream.consumeStream();
      const output = (await stream.getFullOutput()).object as z.infer<typeof judgeSchema> | undefined;
      if (!output) {
        return { decision: 'paused', reason: 'Judge returned no structured decision.' };
      }
      return { decision: output.decision, reason: output.reason };
    } catch (error) {
      return { decision: 'paused', reason: `Judge could not evaluate this turn: ${formatError(error)}` };
    }
  }

  private async getJudgeMemory(state: TUIState): Promise<MastraMemory | null> {
    const harness = state.harness as typeof state.harness & {
      getResolvedMemory?: () => Promise<MastraMemory | null>;
    };
    const memory = (await harness.getResolvedMemory?.()) ?? null;
    if (!memory || !this.goal) return memory;

    const threadId = this.getJudgeThreadId(state);
    const existing = await memory.getThreadById({ threadId });
    if (!existing) {
      await memory.createThread({
        threadId,
        resourceId: state.harness.getResourceId(),
        title: `Goal judge: ${this.goal.objective.slice(0, 80)}`,
        metadata: {
          forkedSubagent: true,
          goalJudge: true,
          parentThreadId: state.harness.getCurrentThreadId(),
          goalId: this.goal.id,
        },
      });
    }
    return memory;
  }

  private getJudgeThreadId(state: TUIState): string {
    return `${state.harness.getCurrentThreadId() ?? 'no-thread'}-${this.goal!.id}`;
  }

  private createJudgeAgent(memory: MastraMemory | null): Agent | null {
    if (!this.goal?.judgeModelId) return null;
    try {
      const model = resolveModel(this.goal.judgeModelId);
      return new Agent({
        id: 'goal-judge',
        name: 'Goal Judge',
        instructions: JUDGE_SYSTEM_PROMPT,
        model,
        ...(memory ? { memory } : {}),
        inputProcessors: [new ProviderHistoryCompat()],
        errorProcessors: [new StreamErrorRetryProcessor(), new PrefillErrorHandler(), new ProviderHistoryCompat()],
      });
    } catch {
      return null;
    }
  }

  private buildContinuationPrompt(judgeReason: string): string {
    const turn = this.goal!.turnsUsed;
    const max = this.goal!.maxTurns;
    const message = `[Goal attempt ${turn}/${max}] The goal is not yet complete. Judge feedback: ${judgeReason}\n\nContinue working toward the goal: ${this.goal!.objective}`;
    return `<system-reminder type="goal-judge">${escapeXml(message)}</system-reminder>`;
  }
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function truncateForJudge(value: string): string {
  return value.length > 4000 ? value.slice(0, 4000) + '\n...[truncated]' : value;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
