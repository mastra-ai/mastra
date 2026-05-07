/**
 * Custom Mock Model for Observational Memory E2E Tests
 *
 * This mock model triggers multi-step execution by returning tool calls on the first
 * call, which causes the agent loop to continue to step 2. The OM processor only
 * triggers observations when stepNumber > 0, so we need this multi-step behavior.
 *
 * Uses a counter-based approach: first call = tool call, all subsequent = text.
 * This is more reliable than checking messages for tool results because OM can
 * clear messages from context after observation.
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
  | {
      type: 'finish';
      finishReason: 'stop' | 'tool-calls';
      usage: { inputTokens: number; outputTokens: number; totalTokens: number };
    };

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
 * On all subsequent calls (step 1+): Returns text response with finishReason: 'stop'
 *
 * Uses a counter-based approach rather than checking messages for tool results,
 * because OM can clear messages from context after observation.
 */
export function createMockOmModel(options: MockOmModelOptions = {}): any {
  const {
    provider = 'mock',
    modelId = 'mock-om-model',
    responseText = 'I understand. Let me help you with that.',
    toolName = 'test',
    toolInput = { action: 'trigger-observation' },
    delayMs = 5,
  } = options;

  // Counter-based step detection using modulo: even calls = tool call, odd calls = text.
  // Each agent turn makes exactly 2 calls (tool + text), so this resets per turn.
  let callCount = 0;

  return {
    specificationVersion: 'v2' as const,
    provider,
    modelId,
    defaultObjectGenerationMode: undefined,
    supportsImageUrls: false,
    supportedUrls: {},

    async doGenerate() {
      const isFirstCall = callCount % 2 === 0;
      callCount++;

      if (isFirstCall) {
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

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        content: [{ type: 'text' as const, text: responseText }],
        warnings: [],
      };
    },

    async doStream() {
      const isFirstCall = callCount % 2 === 0;
      callCount++;

      const parts: StreamPart[] = isFirstCall
        ? [
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
