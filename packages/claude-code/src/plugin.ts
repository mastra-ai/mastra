import { ObservationalMemoryEngine } from './engine.js';
import { resolveConfig } from './config.js';
import type { ResolvedConfig } from './types.js';

/**
 * Mastra Observational Memory Plugin for Claude Code.
 *
 * This plugin integrates with Claude Code's plugin system to:
 * 1. Inject persisted observations into the system prompt at session start
 * 2. Process conversation context after tool use to maintain observations
 * 3. Run reflection when observations grow too large
 *
 * Usage in .claude/settings.json:
 * ```json
 * {
 *   "plugins": {
 *     "@mastra/claude-code": true
 *   }
 * }
 * ```
 *
 * Or run standalone:
 * ```bash
 * npx @mastra/claude-code observe <context-file>
 * npx @mastra/claude-code reflect
 * npx @mastra/claude-code status
 * npx @mastra/claude-code inject
 * ```
 */
export class MastraOMPlugin {
  private engine: ObservationalMemoryEngine;
  private config: ResolvedConfig;

  constructor(config?: ResolvedConfig) {
    this.config = config || resolveConfig();
    this.engine = new ObservationalMemoryEngine(this.config);
  }

  /**
   * Get the plugin manifest for Claude Code.
   */
  getManifest() {
    return {
      name: '@mastra/claude-code',
      version: '0.1.0',
      description: 'Mastra Observational Memory — persistent long-term memory for Claude Code',
      hooks: [
        'on_session_start',
        'on_tool_result',
        'on_session_end',
      ],
    };
  }

  /**
   * Handle session start — inject observations into context.
   */
  onSessionStart(): { system_prompt?: string; message?: string } {
    const injection = this.engine.getContextInjection();

    if (!injection) {
      return {
        message: 'Mastra OM: No previous observations found. Starting fresh.',
      };
    }

    const state = this.engine.getState();
    return {
      system_prompt: injection,
      message: `Mastra OM: Loaded ${state.observationTokens} tokens of observations (gen ${state.generationCount})`,
    };
  }

  /**
   * Handle tool result — accumulate context for observation.
   */
  async onToolResult(payload: { conversation_context?: string }): Promise<{ message?: string }> {
    // This hook receives the conversation context after a tool call
    // We check if it's time to observe
    const context = payload.conversation_context;
    if (!context) {
      return {};
    }

    const contextTokens = this.engine.countTokens(context);
    const state = this.engine.getState();

    // Only observe if we've accumulated enough context
    if (contextTokens < this.config.observationThreshold) {
      return {
        message: `OM: ${contextTokens}/${this.config.observationThreshold} tokens (${Math.round((contextTokens / this.config.observationThreshold) * 100)}%)`,
      };
    }

    const result = await this.engine.processConversation(context);
    return {
      message: `OM: ${result.message}`,
    };
  }

  /**
   * Handle session end — final observation pass.
   */
  async onSessionEnd(payload: { conversation_context?: string }): Promise<{ message?: string }> {
    const context = payload.conversation_context;
    if (!context) {
      return { message: 'OM: Session ended, no context to observe' };
    }

    // Always observe at session end to capture the final state
    const result = await this.engine.forceObserve(context);
    if (result) {
      return {
        message: `OM: Final observation captured. ${result.observations.split('\n').length} lines observed.`,
      };
    }

    return { message: 'OM: Session ended' };
  }

  /**
   * Get the underlying engine for direct API access.
   */
  getEngine(): ObservationalMemoryEngine {
    return this.engine;
  }
}
