import type { Schema } from '@ai-sdk/ui-utils';

import type { z } from 'zod';
import type { CoreMessage } from './prompt/message';
import type { ToolResultContent } from './prompt/tool-result-content';

export type ToolParameters = z.ZodTypeAny | Schema<any>;

export type inferParameters<PARAMETERS extends ToolParameters> =
  PARAMETERS extends Schema<any> ? PARAMETERS['_type'] : PARAMETERS extends z.ZodTypeAny ? z.infer<PARAMETERS> : never;

export interface ToolExecutionOptions {
  /**
   * The ID of the tool call. You can use it e.g. when sending tool-call related information with stream data.
   */
  toolCallId: string;

  /**
   * Messages that were sent to the language model to initiate the response that contained the tool call.
   * The messages **do not** include the system prompt nor the assistant response that contained the tool call.
   */
  messages: CoreMessage[];

  /**
   * An optional abort signal that indicates that the overall operation should be aborted.
   */
  abortSignal?: AbortSignal;
}

/**
A tool contains the description and the schema of the input that the tool expects.
This enables the language model to generate the input.

The tool can also contain an optional execute function for the actual execution function of the tool.
 */
export type Tool<PARAMETERS extends ToolParameters = any, RESULT = any> = {
  /**
The schema of the input that the tool expects. The language model will use this to generate the input.
It is also used to validate the output of the language model.
Use descriptions to make the input understandable for the language model.
   */
  parameters: PARAMETERS;

  /**
An optional description of what the tool does.
Will be used by the language model to decide whether to use the tool.
Not used for provider-defined tools.
   */
  description?: string;

  /**
Optional conversion function that maps the tool result to multi-part tool content for LLMs.
   */
  experimental_toToolResultContent?: (result: RESULT) => ToolResultContent;

  /**
An async function that is called with the arguments from the tool call and produces a result.
If not provided, the tool will not be executed automatically.

@args is the input of the tool call.
@options.abortSignal is a signal that can be used to abort the tool call.
   */
  execute?: (args: inferParameters<PARAMETERS>, options: ToolExecutionOptions) => PromiseLike<RESULT>;
} & (
  | {
      /**
Function tool.
       */
      type?: undefined | 'function';
    }
  | {
      /**
Provider-defined tool.
       */
      type: 'provider-defined';

      /**
The ID of the tool. Should follow the format `<provider-name>.<tool-name>`.
       */
      id: `${string}.${string}`;

      /**
The arguments for configuring the tool. Must match the expected arguments defined by the provider for this tool.
       */
      args: Record<string, unknown>;
    }
);

/**
 * @deprecated Use `Tool` instead.
 */
// TODO remove in v5
export type CoreTool<PARAMETERS extends ToolParameters = any, RESULT = any> = Tool<PARAMETERS, RESULT>;
