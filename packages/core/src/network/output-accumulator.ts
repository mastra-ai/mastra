import type { ChunkType } from '../stream';
import type {
  NetworkStructuredOutput,
  NetworkExecutionStep,
  ToolCallResult,
  StructuredNetworkOutputOptions,
} from './structured-output';

/**
 * Accumulates network stream chunks into a structured output format.
 * Transforms raw event stream into a organized, type-safe output structure.
 */
export class NetworkOutputAccumulator {
  private steps = new Map<string, NetworkExecutionStep>();
  private currentStep: NetworkExecutionStep | null = null;
  private textContent = '';
  private reasoning = '';
  private sources: Array<{ type: string; content: string; metadata?: Record<string, unknown> }> = [];
  private networkId = '';
  private runId = '';
  private startTime = new Date();
  private endTime = new Date();
  private status: 'success' | 'error' | 'incomplete' = 'incomplete';
  private errorMessage = '';
  private tokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    reasoningTokens: 0,
    cachedInputTokens: 0,
  };
  private stepCounter = 0;
  private options: StructuredNetworkOutputOptions;

  constructor(options: StructuredNetworkOutputOptions = {}) {
    this.options = {
      includeToolCalls: true,
      includeSteps: true,
      includeReasoning: false,
      includeSources: false,
      ...options,
    };
  }

  /**
   * Process a single chunk from the network stream
   */
  processChunk(chunk: ChunkType): void {
    if (!chunk) return;

    const type = chunk.type as string;

    switch (type) {
      case 'routing-agent-start':
        this.handleRoutingAgentStart(chunk);
        break;

      case 'routing-agent-end':
        this.handleRoutingAgentEnd(chunk);
        break;

      case 'agent-execution-event-text-delta':
      case 'text-delta':
        this.handleTextDelta(chunk);
        break;

      case 'agent-execution-event-text-start':
      case 'text-start':
        this.handleTextStart(chunk);
        break;

      case 'agent-execution-event-tool-call':
      case 'tool-call':
        this.handleToolCall(chunk);
        break;

      case 'agent-execution-event-tool-result':
      case 'tool-result':
        this.handleToolResult(chunk);
        break;

      case 'reasoning-delta':
        if (this.options.includeReasoning) {
          this.handleReasoningDelta(chunk);
        }
        break;

      case 'source':
        if (this.options.includeSources) {
          this.handleSource(chunk);
        }
        break;

      case 'network-execution-event-step-finish':
        this.handleNetworkStepFinish(chunk);
        break;

      case 'step-output':
        this.handleStepOutput(chunk);
        break;

      case 'step-finish':
        this.handleStepFinish(chunk);
        break;

      case 'step-start':
        this.handleStepStart(chunk);
        break;

      default:
        // Handle other chunk types silently
        break;
    }

    // Update token usage if available
    if ('payload' in chunk && chunk.payload && 'usage' in chunk.payload) {
      this.updateTokenUsage(chunk.payload.usage);
    }
  }

  private handleRoutingAgentStart(chunk: any): void {
    const payload = chunk.payload || {};
    this.networkId = payload.networkId || this.networkId;
    this.runId = chunk.runId || payload.runId || this.runId;
    this.startTime = new Date();
  }

  private handleRoutingAgentEnd(chunk: any): void {
    const payload = chunk.payload || {};

    if (this.options.includeSteps) {
      const stepId = `step_${this.stepCounter++}`;
      const step: NetworkExecutionStep = {
        stepId,
        primitiveId: payload.primitiveId || '',
        primitiveType: payload.primitiveType || 'agent',
        primitiveDescription: payload.description,
        status: 'success',
        input: payload.input,
        output: payload.output,
        duration: payload.duration || 0,
        timestamp: new Date().toISOString(),
      };
      this.steps.set(stepId, step);
    }

    if (payload.usage) {
      this.updateTokenUsage(payload.usage);
    }
  }

  private handleTextDelta(chunk: any): void {
    const payload = chunk.payload || {};
    if (payload.text) {
      this.textContent += payload.text;
    }
  }

  private handleTextStart(chunk: any): void {
    // Reset text content on new text start
    this.textContent = '';
  }

  private handleToolCall(chunk: any): void {
    const payload = chunk.payload || {};

    if (!this.currentStep) {
      const stepId = `step_${this.stepCounter++}`;
      this.currentStep = {
        stepId,
        primitiveId: payload.toolName || 'unknown-tool',
        primitiveType: 'tool',
        status: 'executing',
        input: payload.args || {},
        duration: 0,
        timestamp: new Date().toISOString(),
        toolCalls: [],
      };
    }

    if (this.options.includeToolCalls) {
      const toolCall: ToolCallResult = {
        toolCallId: payload.toolCallId || `${payload.toolName}_${Date.now()}`,
        toolName: payload.toolName || 'unknown',
        args: payload.args || {},
      };
      if (!this.currentStep.toolCalls) {
        this.currentStep.toolCalls = [];
      }
      this.currentStep.toolCalls.push(toolCall);
    }
  }

  private handleToolResult(chunk: any): void {
    const payload = chunk.payload || {};

    if (this.currentStep && this.options.includeToolCalls && this.currentStep.toolCalls?.length) {
      const lastToolCall = this.currentStep.toolCalls[this.currentStep.toolCalls.length - 1];
      if (lastToolCall) {
        lastToolCall.result = payload.result || payload.output;
        if (payload.error) {
          lastToolCall.error = payload.error;
        }
      }
    }
  }

  private handleReasoningDelta(chunk: any): void {
    const payload = chunk.payload || {};
    if (payload.text) {
      this.reasoning += payload.text;
    }
  }

  private handleSource(chunk: any): void {
    const payload = chunk.payload || {};
    this.sources.push({
      type: payload.type || 'unknown',
      content: payload.content || '',
      metadata: payload.metadata,
    });
  }

  private handleNetworkStepFinish(chunk: any): void {
    const payload = chunk.payload || {};
    this.endTime = new Date();
    this.status = payload.status === 'error' ? 'error' : 'success';

    if (payload.result) {
      this.textContent = payload.result;
    }

    if (payload.error) {
      this.errorMessage = payload.error;
      this.status = 'error';
    }

    if (payload.usage) {
      this.updateTokenUsage(payload.usage);
    }
  }

  private handleStepOutput(chunk: any): void {
    const payload = chunk.payload || {};
    const output = payload.output || {};

    // Handle nested output structure
    if (output.type === 'finish') {
      const finishPayload = output.payload || {};
      if (finishPayload.usage) {
        this.updateTokenUsage(finishPayload.usage);
      }
    }
  }

  private handleStepFinish(chunk: any): void {
    const payload = chunk.payload || {};
    if (payload.usage) {
      this.updateTokenUsage(payload.usage);
    }
  }

  private handleStepStart(chunk: any): void {
    const payload = chunk.payload || {};
    if (this.options.includeSteps && payload.id) {
      this.currentStep = {
        stepId: payload.id,
        primitiveId: payload.primitiveId || payload.id,
        primitiveType: payload.primitiveType || 'agent',
        primitiveDescription: payload.description,
        status: 'executing',
        input: payload.input,
        duration: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private updateTokenUsage(usage: any): void {
    if (!usage) return;

    if (usage.inputTokens) {
      this.tokenUsage.inputTokens += parseInt(String(usage.inputTokens), 10);
    }
    if (usage.outputTokens) {
      this.tokenUsage.outputTokens += parseInt(String(usage.outputTokens), 10);
    }
    if (usage.totalTokens) {
      this.tokenUsage.totalTokens += parseInt(String(usage.totalTokens), 10);
    }
    if (usage.reasoningTokens) {
      this.tokenUsage.reasoningTokens += parseInt(String(usage.reasoningTokens), 10);
    }
    if (usage.cachedInputTokens) {
      this.tokenUsage.cachedInputTokens += parseInt(String(usage.cachedInputTokens), 10);
    }
  }

  /**
   * Get the accumulated structured output
   */
  getStructuredOutput(): NetworkStructuredOutput {
    return {
      networkId: this.networkId,
      runId: this.runId,
      steps: this.options.includeSteps ? Array.from(this.steps.values()) : [],
      finalResult: {
        text: this.textContent,
        reasoning: this.options.includeReasoning && this.reasoning ? this.reasoning : undefined,
        sources: this.options.includeSources && this.sources.length > 0 ? this.sources : undefined,
      },
      totalIterations: this.steps.size,
      tokenUsage: {
        inputTokens: this.tokenUsage.inputTokens,
        outputTokens: this.tokenUsage.outputTokens,
        totalTokens: this.tokenUsage.totalTokens,
        reasoningTokens: this.tokenUsage.reasoningTokens || undefined,
        cachedInputTokens: this.tokenUsage.cachedInputTokens || undefined,
      },
      status: this.status,
      error: this.errorMessage || undefined,
      startTime: this.startTime.toISOString(),
      endTime: this.endTime.toISOString(),
      durationMs: this.endTime.getTime() - this.startTime.getTime(),
    };
  }

  /**
   * Reset the accumulator for a new stream
   */
  reset(): void {
    this.steps.clear();
    this.currentStep = null;
    this.textContent = '';
    this.reasoning = '';
    this.sources = [];
    this.networkId = '';
    this.runId = '';
    this.startTime = new Date();
    this.endTime = new Date();
    this.status = 'incomplete';
    this.errorMessage = '';
    this.stepCounter = 0;
    this.tokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      reasoningTokens: 0,
      cachedInputTokens: 0,
    };
  }
}
