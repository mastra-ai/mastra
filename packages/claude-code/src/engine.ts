import { execSync } from 'node:child_process';
import { TokenCounter } from './token-counter.js';
import { FileStorage } from './storage.js';
import { parseObserverOutput, optimizeObservations } from './observer.js';
import { parseReflectorOutput, validateCompression } from './reflector.js';
import {
  OBSERVER_SYSTEM_PROMPT,
  REFLECTOR_SYSTEM_PROMPT,
  buildObserverPrompt,
  buildReflectorPrompt,
  formatObservationsForSystemPrompt,
} from './prompts.js';
import type { MemoryState, ResolvedConfig, ObserverResult } from './types.js';

/**
 * Core engine for Mastra Observational Memory in Claude Code.
 *
 * Manages the observation/reflection cycle:
 * 1. Before each conversation turn, injects existing observations into context
 * 2. After each turn, checks if observation threshold is reached
 * 3. When threshold hit: runs Observer to extract observations from conversation
 * 4. When observations grow too large: runs Reflector to compress them
 */
export class ObservationalMemoryEngine {
  private config: ResolvedConfig;
  private storage: FileStorage;
  private tokenCounter: TokenCounter;

  constructor(config: ResolvedConfig) {
    this.config = config;
    this.storage = new FileStorage(config);
    this.tokenCounter = new TokenCounter();
  }

  /**
   * Get the current observations formatted for injection into the system prompt.
   * Called at the start of each conversation turn.
   */
  getContextInjection(): string {
    const state = this.storage.loadState();

    if (!state.observations) {
      return '';
    }

    const optimized = optimizeObservations(state.observations);
    return formatObservationsForSystemPrompt(
      optimized,
      state.currentTask,
      state.suggestedResponse,
    );
  }

  /**
   * Process new conversation context and decide whether to observe/reflect.
   *
   * @param conversationContext - The conversation text from the current session
   * @returns Summary of what happened
   */
  async processConversation(conversationContext: string): Promise<{
    observed: boolean;
    reflected: boolean;
    observationTokens: number;
    message: string;
  }> {
    const state = this.storage.loadState();
    const contextTokens = this.tokenCounter.count(conversationContext);

    this.debug(`Context tokens: ${contextTokens}, observation threshold: ${this.config.observationThreshold}`);

    // Check if we need to observe
    if (contextTokens < this.config.observationThreshold) {
      return {
        observed: false,
        reflected: false,
        observationTokens: state.observationTokens,
        message: `Context (${contextTokens} tokens) below observation threshold (${this.config.observationThreshold})`,
      };
    }

    // Run observation
    this.debug('Observation threshold reached, running Observer...');
    const observerResult = await this.runObserver(state, conversationContext);

    if (!observerResult) {
      return {
        observed: false,
        reflected: false,
        observationTokens: state.observationTokens,
        message: 'Observer failed to produce results',
      };
    }

    // Append new observations
    const newObservations = state.observations
      ? `${state.observations}\n\n${observerResult.observations}`
      : observerResult.observations;

    const newObservationTokens = this.tokenCounter.count(newObservations);

    // Update state
    const updatedState: MemoryState = {
      ...state,
      observations: newObservations,
      observationTokens: newObservationTokens,
      lastObservedAt: new Date().toISOString(),
      currentTask: observerResult.currentTask || state.currentTask,
      suggestedResponse: observerResult.suggestedResponse || state.suggestedResponse,
    };

    this.debug(`New observation tokens: ${newObservationTokens}, reflection threshold: ${this.config.reflectionThreshold}`);

    // Check if we need to reflect
    let reflected = false;
    if (newObservationTokens >= this.config.reflectionThreshold) {
      this.debug('Reflection threshold reached, running Reflector...');
      const reflectionResult = await this.runReflector(updatedState);

      if (reflectionResult) {
        // Archive pre-reflection observations
        this.storage.archiveObservations(updatedState.observations, updatedState.generationCount);

        updatedState.observations = reflectionResult.observations;
        updatedState.observationTokens = reflectionResult.tokenCount;
        updatedState.generationCount += 1;
        reflected = true;
      }
    }

    this.storage.saveState(updatedState);

    return {
      observed: true,
      reflected,
      observationTokens: updatedState.observationTokens,
      message: reflected
        ? `Observed and reflected (gen ${updatedState.generationCount}). Observations: ${updatedState.observationTokens} tokens`
        : `Observed. Observations: ${updatedState.observationTokens} tokens`,
    };
  }

  /**
   * Force an observation of the given context, regardless of threshold.
   */
  async forceObserve(conversationContext: string): Promise<ObserverResult | null> {
    const state = this.storage.loadState();
    const result = await this.runObserver(state, conversationContext);

    if (result) {
      const newObservations = state.observations
        ? `${state.observations}\n\n${result.observations}`
        : result.observations;

      const newTokens = this.tokenCounter.count(newObservations);

      this.storage.saveState({
        ...state,
        observations: newObservations,
        observationTokens: newTokens,
        lastObservedAt: new Date().toISOString(),
        currentTask: result.currentTask || state.currentTask,
        suggestedResponse: result.suggestedResponse || state.suggestedResponse,
      });
    }

    return result;
  }

  /**
   * Force a reflection, regardless of threshold.
   */
  async forceReflect(): Promise<boolean> {
    const state = this.storage.loadState();

    if (!state.observations) {
      this.debug('No observations to reflect on');
      return false;
    }

    const result = await this.runReflector(state);
    if (!result) return false;

    this.storage.archiveObservations(state.observations, state.generationCount);

    this.storage.saveState({
      ...state,
      observations: result.observations,
      observationTokens: result.tokenCount,
      generationCount: state.generationCount + 1,
    });

    return true;
  }

  /**
   * Get the current memory state.
   */
  getState(): MemoryState {
    return this.storage.loadState();
  }

  /**
   * Get the token count for a string.
   */
  countTokens(text: string): number {
    return this.tokenCounter.count(text);
  }

  // ═══════════════════════════════════════════════════════════
  // Private methods
  // ═══════════════════════════════════════════════════════════

  private async runObserver(state: MemoryState, context: string): Promise<ObserverResult | null> {
    const prompt = buildObserverPrompt(
      state.observations || undefined,
      context,
    );

    try {
      const output = await this.callLLM(OBSERVER_SYSTEM_PROMPT, prompt);
      return parseObserverOutput(output);
    } catch (err) {
      this.debug(`Observer error: ${err}`);
      return null;
    }
  }

  private async runReflector(state: MemoryState): Promise<{ observations: string; tokenCount: number } | null> {
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const compressionLevel = attempt as 0 | 1 | 2;
      const prompt = buildReflectorPrompt(state.observations, compressionLevel);

      try {
        const output = await this.callLLM(REFLECTOR_SYSTEM_PROMPT, prompt);
        const result = parseReflectorOutput(output, this.tokenCounter);

        if (validateCompression(result.tokenCount, this.config.reflectionThreshold)) {
          return result;
        }

        this.debug(
          `Reflection attempt ${attempt + 1}: ${result.tokenCount} tokens (threshold: ${this.config.reflectionThreshold}), retrying with more compression`,
        );
      } catch (err) {
        this.debug(`Reflector error (attempt ${attempt + 1}): ${err}`);
      }
    }

    return null;
  }

  /**
   * Call an LLM using the `claude` CLI.
   *
   * This uses the `claude` CLI which is available in Claude Code environments.
   * The model is configurable but defaults to claude-sonnet-4 for observation/reflection
   * since these are background tasks that benefit from speed.
   */
  private async callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
    // Use Claude CLI's --print flag for non-interactive mode
    // Escape the prompts for shell safety
    const combinedPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

    // Write prompt to a temp approach using stdin
    const result = execSync(
      `claude --print --model ${this.config.model} -`,
      {
        input: combinedPrompt,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
        timeout: 120_000, // 2 minute timeout
      },
    );

    return result.trim();
  }

  private debug(msg: string): void {
    if (this.config.debug) {
      const timestamp = new Date().toISOString();
      console.error(`[mastra-om ${timestamp}] ${msg}`);
    }
  }
}
