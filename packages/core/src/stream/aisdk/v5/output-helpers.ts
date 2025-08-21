import type { ReasoningUIPart, StepResult, ToolSet } from 'ai-v5';
import type { MastraMessageV2 } from '../../../memory';
import type { StepBufferItem } from '../../types';

export class DefaultStepResult<TOOLS extends ToolSet> implements StepResult<TOOLS> {
  readonly content: StepResult<TOOLS>['content'];
  readonly finishReason: StepResult<TOOLS>['finishReason'];
  readonly usage: StepResult<TOOLS>['usage'];
  readonly warnings: StepResult<TOOLS>['warnings'];
  readonly request: StepResult<TOOLS>['request'];
  readonly response: StepResult<TOOLS>['response'];
  readonly providerMetadata: StepResult<TOOLS>['providerMetadata'];

  constructor({
    content,
    finishReason,
    usage,
    warnings,
    request,
    response,
    providerMetadata,
  }: {
    content: StepResult<TOOLS>['content'];
    finishReason: StepResult<TOOLS>['finishReason'];
    usage: StepResult<TOOLS>['usage'];
    warnings: StepResult<TOOLS>['warnings'];
    request: StepResult<TOOLS>['request'];
    response: StepResult<TOOLS>['response'];
    providerMetadata: StepResult<TOOLS>['providerMetadata'];
  }) {
    this.content = content;
    this.finishReason = finishReason;
    this.usage = usage;
    this.warnings = warnings;
    this.request = request;
    this.response = response;
    this.providerMetadata = providerMetadata;
  }

  get text() {
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

  get sources() {
    return this.content.filter(part => part.type === 'source');
  }

  get toolCalls() {
    return this.content.filter(part => part.type === 'tool-call');
  }

  get staticToolCalls() {
    // @ts-ignore
    return this.toolCalls.filter((toolCall): toolCall is StaticToolCall<TOOLS> => toolCall.dynamic === false);
  }

  get dynamicToolCalls() {
    // @ts-ignore
    return this.toolCalls.filter((toolCall): toolCall is DynamicToolCall => toolCall.dynamic === true);
  }

  get toolResults() {
    return this.content.filter(part => part.type === 'tool-result');
  }

  get staticToolResults() {
    // @ts-ignore
    return this.toolResults.filter((toolResult): toolResult is StaticToolResult<TOOLS> => toolResult.dynamic === false);
  }

  get dynamicToolResults() {
    // @ts-ignore
    return this.toolResults.filter((toolResult): toolResult is DynamicToolResult => toolResult.dynamic === true);
  }
}

export function reasoningDetailsFromMessages(messages: MastraMessageV2[]): ReasoningUIPart[] {
  return messages
    .flatMap(msg => {
      if (msg.content?.parts && Array.isArray(msg.content.parts)) {
        return msg.content.parts;
      }
      return [];
    })
    .filter(part => part.type === `reasoning`)
    .flatMap(part => {
      return {
        type: 'reasoning',
        text: part.reasoning,
        details: part.details,
      };
    });
}

export function transformSteps({ steps }: { steps: StepBufferItem[] }): DefaultStepResult<any>[] {
  return steps.map(step => {
    if (!step.response) throw new Error(`No step response found while transforming steps but one was expected.`);
    if (!step.request) throw new Error(`No step request found while transforming steps but one was expected.`);
    return new DefaultStepResult({
      content: step.content,
      warnings: step.warnings ?? [],
      providerMetadata: step.providerMetadata,
      finishReason: step.finishReason || 'unknown',
      response: step.response,
      request: step.request,
      usage: step.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    });
  });
}
