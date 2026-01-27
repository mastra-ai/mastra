/**
 * Custom Mock Model for Observational Memory E2E Tests
 *
 * This mock model triggers multi-step execution by returning tool calls on the first
 * step, which causes the agent loop to continue to step 2. The OM processor only
 * triggers observations when stepNumber > 0, so we need this multi-step behavior.
 *
 * Flow:
 * 1. Step 0: Model returns tool-call with finishReason: 'tool-calls'
 * 2. Tool executes, results added to messages
 * 3. Step 1: Model returns text with finishReason: 'stop'
 * 4. OM processor sees stepNumber=1, checks threshold, triggers observation
 */

type StreamPart =
  | { type: 'stream-start'; warnings: unknown[] }
  | { type: 'response-metadata'; id: string; modelId: string; timestamp: Date }
  | { type: 'text-start'; id: string }
  | { type: 'text-delta'; id?: string; delta: string }
  | { type: 'text-end'; id: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; input: string }
  | { type: 'finish'; finishReason: 'stop' | 'tool-calls'; usage: { inputTokens: number; outputTokens: number; totalTokens: number } };

interface MockOmModelOptions {
  provider?: string;
  modelId?: string;
  /** Text to return on the final step (after tool execution) */
  responseText?: string;
  /** Tool name to call on step 0 */
  toolName?: string;
  /** Tool input to pass on step 0 */
  toolInput?: Record<string, unknown>;
  delayMs?: number;
}

/**
 * Creates a mock language model that triggers multi-step execution for OM testing.
 * 
 * On first call (step 0): Returns a tool call with finishReason: 'tool-calls'
 * On second call (step 1+): Returns text response with finishReason: 'stop'
 * 
 * This allows the OM processor to trigger on step 1 when threshold is met.
 * 
 * The model detects whether it's on step 0 or step 1+ by checking if the messages
 * contain a tool result. This ensures correct behavior across multiple requests.
 */
export function createMockOmModel(options: MockOmModelOptions = {}): any {
  const { 
    provider = 'mock', 
    modelId = 'mock-om-model', 
    responseText = 'I understand. Let me help you with that.',
    toolName = 'om-trigger-tool',
    toolInput = { action: 'trigger-observation' },
    delayMs = 5 
  } = options;

  // Helper to check if this is a continuation (step 1+) by looking for tool results
  const isStepOne = (callOptions: any): boolean => {
    const messages = callOptions?.prompt || [];
    // If there's a tool result in the messages, we're on step 1+
    return messages.some((msg: any) => 
      msg.role === 'tool' || 
      (Array.isArray(msg.content) && msg.content.some((part: any) => part.type === 'tool-result'))
    );
  };

  return {
    specificationVersion: 'v2' as const,
    provider,
    modelId,
    defaultObjectGenerationMode: undefined,
    supportsImageUrls: false,
    supportedUrls: {},

    async doGenerate(callOptions: unknown) {
      const onStepOne = isStepOne(callOptions);
      console.log(`[MockOmModel doGenerate] isStepOne: ${onStepOne}`);
      
      if (!onStepOne) {
        // Step 0: return tool call
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: `call-${Date.now()}`,
              toolName,
              input: JSON.stringify(toolInput),
            },
          ],
          warnings: [],
        };
      }
      
      // Step 1+: return text
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        content: [{ type: 'text' as const, text: responseText }],
        warnings: [],
      };
    },

    async doStream(callOptions: unknown) {
      const onStepOne = isStepOne(callOptions);
      console.log(`[MockOmModel doStream] isStepOne: ${onStepOne}`);
      
      const parts: StreamPart[] = !onStepOne
        ? [
            // Step 0: Return tool call to trigger multi-step
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId, timestamp: new Date() },
            {
              type: 'tool-call',
              toolCallId: `call-${Date.now()}`,
              toolName,
              input: JSON.stringify(toolInput),
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
            },
          ]
        : [
            // Step 1+: Return text response (OM will trigger here if threshold met)
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId, timestamp: new Date() },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: responseText },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
            },
          ];

      const stream = new ReadableStream<StreamPart>({
        async start(controller) {
          for (const part of parts) {
            controller.enqueue(part);
            if (delayMs > 0) {
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }
          }
          controller.close();
        },
      });

      return {
        stream,
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  };
}
