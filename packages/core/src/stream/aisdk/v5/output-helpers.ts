import type {
  StepResult,
  ToolSet,
  StaticToolCall,
  StaticToolResult,
  DynamicToolCall,
  DynamicToolResult,
} from '@internal/ai-sdk-v5';
import { WORKFLOW_SNAPSHOT_SERIALIZER } from '../../../workflows/snapshot-serialization';
import type { StepTripwireData } from '../../types';

export { WORKFLOW_SNAPSHOT_SERIALIZER };

// ContentPart is not exported from ai, so we derive it from StepResult
type ContentPart<TOOLS extends ToolSet> = StepResult<TOOLS>['content'][number];
export class DefaultStepResult<TOOLS extends ToolSet> implements StepResult<TOOLS> {
  readonly content: StepResult<TOOLS>['content'];
  readonly finishReason: StepResult<TOOLS>['finishReason'];
  readonly usage: StepResult<TOOLS>['usage'];
  readonly warnings: StepResult<TOOLS>['warnings'];
  readonly request: StepResult<TOOLS>['request'];
  readonly response: StepResult<TOOLS>['response'];
  readonly providerMetadata: StepResult<TOOLS>['providerMetadata'];
  readonly #serializedResponseMessages?: StepResult<TOOLS>['response']['messages'];
  /** Tripwire data if this step was rejected by a processor */
  readonly tripwire?: StepTripwireData;

  constructor({
    content,
    finishReason,
    usage,
    warnings,
    request,
    response,
    providerMetadata,
    serializedResponseMessages,
    tripwire,
  }: {
    content: StepResult<TOOLS>['content'];
    finishReason: StepResult<TOOLS>['finishReason'];
    usage: StepResult<TOOLS>['usage'];
    warnings: StepResult<TOOLS>['warnings'];
    request: StepResult<TOOLS>['request'];
    response: StepResult<TOOLS>['response'];
    providerMetadata: StepResult<TOOLS>['providerMetadata'];
    serializedResponseMessages?: StepResult<TOOLS>['response']['messages'];
    tripwire?: StepTripwireData;
  }) {
    this.content = content;
    this.finishReason = finishReason;
    this.usage = usage;
    this.warnings = warnings;
    this.request = request;
    this.response = response;
    this.providerMetadata = providerMetadata;
    this.#serializedResponseMessages = serializedResponseMessages;
    this.tripwire = tripwire;
  }

  /**
   * Workflow snapshot persistence hook: persist only the response messages this
   * step added (when known) instead of the cumulative history, so long agentic
   * runs don't store the conversation once per step. Runtime consumers keep
   * reading the cumulative `this.response.messages`.
   */
  [WORKFLOW_SNAPSHOT_SERIALIZER]() {
    return {
      content: this.content,
      finishReason: this.finishReason,
      usage: this.usage,
      warnings: this.warnings,
      request: this.request,
      response: {
        ...this.response,
        ...(this.#serializedResponseMessages ? { messages: this.#serializedResponseMessages } : {}),
      },
      providerMetadata: this.providerMetadata,
      tripwire: this.tripwire,
    };
  }

  get text() {
    // Return empty string if this step was rejected by a tripwire
    if (this.tripwire) {
      return '';
    }
    return this.content
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('');
  }

  get reasoning() {
    return this.content.filter(part => part.type === 'reasoning');
  }

  get reasoningText() {
    return this.reasoning.length === 0 ? undefined : this.reasoning.map(part => part.text).join('');
  }

  get files() {
    return this.content.filter(part => part.type === 'file').map(part => part.file);
  }

  get sources(): Extract<ContentPart<TOOLS>, { type: 'source' }>[] {
    return this.content.filter(part => part.type === 'source');
  }

  get toolCalls() {
    return this.content.filter(part => part.type === 'tool-call');
  }

  get staticToolCalls() {
    return this.toolCalls.filter((toolCall): toolCall is StaticToolCall<TOOLS> => toolCall.dynamic === false);
  }

  get dynamicToolCalls() {
    return this.toolCalls.filter((toolCall): toolCall is DynamicToolCall => toolCall.dynamic === true);
  }

  get toolResults() {
    return this.content.filter(part => part.type === 'tool-result');
  }

  get staticToolResults() {
    return this.toolResults.filter((toolResult): toolResult is StaticToolResult<TOOLS> => toolResult.dynamic === false);
  }

  get dynamicToolResults() {
    return this.toolResults.filter((toolResult): toolResult is DynamicToolResult => toolResult.dynamic === true);
  }
}
