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
import { createWorkspaceTools } from '@mastra/core/workspace';
import { z } from 'zod';

import { resolveModel } from '../agents/model.js';
import { MC_TOOLS } from '../tool-names.js';

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
  startedAt: string;
  activeStartedAt?: string;
  activeDurationMs?: number;
  /** Set when the goal was paused because the judge could not complete evaluation. */
  lastPauseWasJudgeFailure?: boolean;
}

export interface GoalJudgeResult {
  decision: 'done' | 'continue' | 'waiting' | 'paused';
  reason: string;
}

export interface GoalEvaluationResult {
  continuation: string | null;
  judgeResult: GoalJudgeResult | null;
}

export interface GoalEvaluationOptions {
  abortSignal?: AbortSignal;
  onActivity?: (line: string) => void;
  requireAssistantMessage?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

export const DEFAULT_MAX_TURNS = 50;
const THREAD_GOAL_KEY = 'goal';
const JUDGE_MAX_STEPS = 50;

const JUDGE_RETRY_PROMPT =
  'You did not produce a structured decision. You MUST respond with a JSON object containing "decision" (one of "done", "continue", or "waiting") and "reason" (a brief explanation). Do not use any tools — respond with the JSON decision immediately based on what you already know.';

const JUDGE_SYSTEM_PROMPT = `You are the goal judge. Your decision directly controls whether the assistant continues working toward the goal.

Given a goal and the assistant's latest response, reason about whether the goal's requirements have been satisfied. Compare what the goal asks for against what the assistant has actually produced. Focus on substance, not phrasing.

Use "done" when the goal is fully achieved.
Use "waiting" when the goal explicitly requires a user checkpoint, user feedback, human verification, human confirmation, or another external event outside the goal-judge loop before the assistant should continue, and the assistant has correctly stopped at that checkpoint.
Use "waiting" when the latest user message asks a question or requests clarification and the latest assistant message answers it; let the user acknowledge the answer, ask a follow-up, or otherwise return control before continuing goal work. Use common sense and do not wait if the user explicitly asked the assistant to continue autonomously after answering.
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
    const now = new Date().toISOString();
    this.goal = {
      id: randomUUID(),
      objective,
      status: 'active',
      turnsUsed: 0,
      maxTurns,
      judgeModelId,
      startedAt: now,
      activeStartedAt: now,
      activeDurationMs: 0,
    };
    return this.goal;
  }

  /**
   * Load goal state from thread metadata (called on thread switch).
   */
  loadFromThreadMetadata(metadata: Record<string, unknown> | undefined): void {
    const saved = metadata?.[THREAD_GOAL_KEY] as GoalState | undefined;
    if (saved && saved.objective && saved.status) {
      this.goal = {
        ...saved,
        id: saved.id ?? randomUUID(),
        startedAt: saved.startedAt ?? new Date().toISOString(),
        activeStartedAt: undefined,
        activeDurationMs: saved.activeDurationMs ?? 0,
      };
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
      this.stopActiveTimer();
      this.goal.status = 'paused';
    }
    return this.goal;
  }

  resume(): GoalState | null {
    if (this.goal && this.goal.status === 'paused') {
      this.goal.status = 'active';
      this.startActiveTimer();
    }
    return this.goal;
  }

  startActiveTimer(): void {
    if (this.goal?.status === 'active' && !this.goal.activeStartedAt) {
      this.goal.activeStartedAt = new Date().toISOString();
    }
  }

  stopActiveTimer(): void {
    if (!this.goal?.activeStartedAt) return;
    const activeStartedMs = Date.parse(this.goal.activeStartedAt);
    if (Number.isFinite(activeStartedMs)) {
      this.goal.activeDurationMs = (this.goal.activeDurationMs ?? 0) + Math.max(0, Date.now() - activeStartedMs);
    }
    this.goal.activeStartedAt = undefined;
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
      this.stopActiveTimer();
      this.goal.status = 'done';
    }
  }

  /**
   * Called after each agent turn completes. Evaluates whether to continue.
   * Returns a GoalEvaluationResult with continuation prompt and judge result.
   */
  async evaluateAfterTurn(state: TUIState, options: GoalEvaluationOptions = {}): Promise<GoalEvaluationResult> {
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
      if (options.requireAssistantMessage) {
        const result = {
          decision: 'paused' as const,
          reason: 'Judge could not evaluate this turn: no assistant response.',
        };
        this.stopActiveTimer();
        this.goal.status = 'paused';
        this.goal.lastPauseWasJudgeFailure = true;
        await this.saveToThread(state);
        return { continuation: null, judgeResult: result };
      }

      // No assistant message to judge — continue anyway (but check budget)
      if (this.goal.turnsUsed >= this.goal.maxTurns) {
        this.stopActiveTimer();
        this.goal.status = 'paused';
        this.goal.lastPauseWasJudgeFailure = false;
        await this.saveToThread(state);
        return { continuation: null, judgeResult: null };
      }
      await this.saveToThread(state);
      return { continuation: this.buildContinuationPrompt('No response yet, keep working.'), judgeResult: null };
    }

    // Call judge — always judge the current turn's response before enforcing budget
    const result = await this.callJudge(
      state,
      {
        lastUserContent: context.lastUserContent,
        assistantStepsSinceLastUser: context.assistantStepsSinceLastUser,
        lastAssistantContent: context.lastAssistantContent,
      },
      options,
    );
    if (!this.goal || this.goal.id !== evaluatedGoalId || this.goal.status !== 'active') {
      return { continuation: null, judgeResult: null };
    }
    if (result.decision === 'continue' || result.decision === 'done') {
      this.goal.turnsUsed++;
      this.goal.lastPauseWasJudgeFailure = false;
    }
    if (result.decision === 'paused') {
      this.stopActiveTimer();
      this.goal.status = 'paused';
      this.goal.lastPauseWasJudgeFailure = isJudgeFailureReason(result.reason);
      await this.saveToThread(state);
      return { continuation: null, judgeResult: result };
    }

    if (result.decision === 'done') {
      this.stopActiveTimer();
      this.goal.status = 'done';
      await this.saveToThread(state);
      return { continuation: null, judgeResult: result };
    }

    if (result.decision === 'waiting') {
      this.stopActiveTimer();
      await this.saveToThread(state);
      return { continuation: null, judgeResult: result };
    }

    // Budget exhaustion (checked after judging so the last turn can still be marked done)
    if (this.goal.turnsUsed >= this.goal.maxTurns) {
      this.stopActiveTimer();
      this.goal.status = 'paused';
      this.goal.lastPauseWasJudgeFailure = false;
      await this.saveToThread(state);
      return { continuation: null, judgeResult: result };
    }

    this.startActiveTimer();
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
        lastUserIndex >= 0
          ? messages.slice(lastUserIndex + 1).filter((msg: any) => msg.role === 'assistant').length
          : 0;

      return { lastUserContent, assistantStepsSinceLastUser, lastAssistantContent };
    } catch {
      return { lastUserContent: null, assistantStepsSinceLastUser: 0, lastAssistantContent: null };
    }
  }

  private extractTextContent(content: unknown): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map((part: any) => {
          if (typeof part === 'string') return part;
          if (typeof part?.text === 'string') return part.text;
          if (typeof part?.content === 'string') return part.content;
          return null;
        })
        .filter((text: string | null): text is string => Boolean(text))
        .join('\n');
    }
    return String(content ?? '');
  }

  private async callJudge(
    state: TUIState,
    context: { lastUserContent: string | null; assistantStepsSinceLastUser: number; lastAssistantContent: string },
    options: GoalEvaluationOptions,
  ): Promise<GoalJudgeResult> {
    try {
      const memory = await this.getJudgeMemory(state);
      const tools = await this.createJudgeTools(state);
      const judgeAgent = this.createJudgeAgent(memory, tools);
      if (!judgeAgent) {
        return { decision: 'paused', reason: 'Judge model could not be initialized.' };
      }

      const recentUser = context.lastUserContent
        ? `\n\nLatest user message:\n${truncateForJudge(context.lastUserContent)}\n\nAssistant steps since that user message: ${context.assistantStepsSinceLastUser}`
        : '';

      const prompt = `Goal: ${this.goal!.objective}${recentUser}\n\nLatest assistant message:\n${context.lastAssistantContent}`;
      const memoryOpts = memory
        ? { memory: { thread: this.getJudgeThreadId(state), resource: state.harness.getResourceId() } }
        : {};
      const streamOpts = {
        ...memoryOpts,
        abortSignal: options.abortSignal,
        maxSteps: JUDGE_MAX_STEPS,
        structuredOutput: {
          schema: judgeSchema,
          errorStrategy: 'warn' as const,
        },
      };

      const stream = await judgeAgent.stream(prompt, streamOpts as any);
      await this.consumeJudgeStream(stream, options.onActivity);
      const output = (await stream.getFullOutput()).object as GoalJudgeResult | undefined;
      if (output) {
        return { decision: output.decision, reason: output.reason };
      }
      if (options.abortSignal?.aborted) {
        return { decision: 'paused', reason: 'Judge evaluation was interrupted.' };
      }

      // Follow up: the judge failed to produce a structured decision. Send a
      // follow-up prompt asking it to respond with the required JSON. The judge
      // has memory, so it sees its own previous messages.
      options.onActivity?.('retrying (no structured decision)');
      const retryStream = await judgeAgent.stream(JUDGE_RETRY_PROMPT, streamOpts as any);
      await this.consumeJudgeStream(retryStream, options.onActivity);
      const retryOutput = (await retryStream.getFullOutput()).object as GoalJudgeResult | undefined;
      if (retryOutput) {
        return { decision: retryOutput.decision, reason: retryOutput.reason };
      }
      return { decision: 'paused', reason: 'Judge returned no structured decision.' };
    } catch (error) {
      if (options.abortSignal?.aborted) {
        return { decision: 'paused', reason: 'Judge evaluation was interrupted.' };
      }
      return { decision: 'paused', reason: `Judge could not evaluate this turn: ${formatError(error)}` };
    }
  }

  private async createJudgeTools(state: TUIState): Promise<Record<string, any>> {
    const workspace = state.harness.getWorkspace?.() ?? state.workspace;
    if (!workspace) return {};

    const workspaceTools = await createWorkspaceTools(workspace, {
      requestContext: {},
      workspace,
    });
    const allowedTools = new Set<string>([
      MC_TOOLS.VIEW,
      MC_TOOLS.SEARCH_CONTENT,
      MC_TOOLS.FIND_FILES,
      MC_TOOLS.FILE_STAT,
      MC_TOOLS.LSP_INSPECT,
    ]);
    const tools: Record<string, any> = {};

    for (const [name, tool] of Object.entries(workspaceTools)) {
      if (!allowedTools.has(name)) continue;
      const { needsApprovalFn: _needsApprovalFn, ...toolWithoutApproval } = tool as Record<string, any>;
      tools[name] = { ...toolWithoutApproval, requireApproval: false };
    }

    return tools;
  }

  private async consumeJudgeStream(stream: any, onActivity?: (line: string) => void): Promise<void> {
    if (!stream.fullStream) {
      await stream.consumeStream();
      return;
    }

    for await (const chunk of stream.fullStream) {
      if (chunk?.type === 'tool-call') {
        const toolName = getToolName(chunk);
        if (!toolName) continue;
        const line = formatJudgeActivity(toolName, parseToolInput(chunk));
        if (line) onActivity?.(line);
      }
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

  private createJudgeAgent(memory: MastraMemory | null, tools: Record<string, any>): Agent | null {
    if (!this.goal?.judgeModelId) return null;
    try {
      const model = resolveModel(this.goal.judgeModelId);
      return new Agent({
        id: 'goal-judge',
        name: 'Goal Judge',
        instructions: JUDGE_SYSTEM_PROMPT,
        model,
        tools,
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
    return `[Goal attempt ${turn}/${max}] The goal is not yet complete. Judge feedback: ${judgeReason}\n\nContinue working toward the goal: ${this.goal!.objective}`;
  }
}

function truncateForJudge(value: string): string {
  return value.length > 4000 ? value.slice(0, 4000) + '\n...[truncated]' : value;
}

function getToolName(chunk: any): string | null {
  const toolName = chunk.payload?.toolName ?? chunk.toolName;
  return typeof toolName === 'string' ? toolName : null;
}

function parseToolInput(chunk: any): Record<string, any> {
  const input = chunk.payload?.args ?? chunk.input ?? chunk.args ?? chunk.toolInput;
  if (!input) return {};
  if (typeof input === 'string') {
    try {
      return JSON.parse(input);
    } catch {
      return { input };
    }
  }
  return input as Record<string, any>;
}

function formatJudgeActivity(toolName: string, input: Record<string, any>): string | null {
  if (toolName === MC_TOOLS.VIEW) return `read ${formatActivityValue(input.path)}`;
  if (toolName === MC_TOOLS.SEARCH_CONTENT) return `search ${formatQuotedActivityValue(input.pattern)}`;
  if (toolName === MC_TOOLS.FIND_FILES) return `find files ${formatActivityValue(input.pattern ?? input.path)}`;
  if (toolName === MC_TOOLS.FILE_STAT) return `stat ${formatActivityValue(input.path)}`;
  if (toolName === MC_TOOLS.LSP_INSPECT) return `inspect ${formatActivityValue(input.path)}`;
  return null;
}

function formatActivityValue(value: unknown): string {
  if (typeof value === 'string' && value.length > 0) {
    return value.length > 80 ? value.slice(0, 77) + '...' : value;
  }
  return 'workspace';
}

function formatQuotedActivityValue(value: unknown): string {
  const formatted = formatActivityValue(value);
  return formatted === 'workspace' ? formatted : JSON.stringify(formatted);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const JUDGE_FAILURE_PATTERNS = [
  'no structured decision',
  'could not be initialized',
  'could not evaluate',
  'was interrupted',
];

function isJudgeFailureReason(reason: string): boolean {
  const lower = reason.toLowerCase();
  return JUDGE_FAILURE_PATTERNS.some(p => lower.includes(p));
}
