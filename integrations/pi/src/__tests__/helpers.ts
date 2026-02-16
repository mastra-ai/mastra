import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export function createInMemoryStorage(): InMemoryMemory {
  const db = new InMemoryDB();
  return new InMemoryMemory({ db });
}

// ---------------------------------------------------------------------------
// Mock observer model (satisfies the ai-sdk LanguageModelV2 contract)
// ---------------------------------------------------------------------------

export function createMockObserverModel() {
  return {
    specificationVersion: 'v2' as const,
    provider: 'mock-observer',
    modelId: 'mock-observer-model',
    defaultObjectGenerationMode: undefined,
    supportsImageUrls: false,
    supportedUrls: {},

    async doGenerate() {
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
        content: [
          {
            type: 'text' as const,
            text: `<observations>
## February 15, 2026

### Session
- 🔴 User discussed building integrations
- 🟡 Assistant explained observational memory
</observations>
<current-task>Building Pi integration tests</current-task>
<suggested-response>Let me continue helping.</suggested-response>`,
          },
        ],
        warnings: [],
      };
    },

    async doStream() {
      const text = `<observations>
## February 15, 2026
- 🔴 User discussed building integrations
</observations>
<current-task>Building Pi integration tests</current-task>
<suggested-response>Continue.</suggested-response>`;

      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({
            type: 'response-metadata',
            id: 'obs-1',
            modelId: 'mock-observer-model',
            timestamp: new Date(),
          });
          controller.enqueue({ type: 'text-start', id: 'text-1' });
          controller.enqueue({ type: 'text-delta', id: 'text-1', delta: text });
          controller.enqueue({ type: 'text-end', id: 'text-1' });
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
          });
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

// ---------------------------------------------------------------------------
// Pi-style message factories
// ---------------------------------------------------------------------------

export function piMessage(role: 'user' | 'assistant', text: string, timestamp?: number): any {
  return {
    role,
    content: [{ type: 'text', text }],
    timestamp: timestamp ?? Date.now(),
  };
}

export function createMessagesExceedingThreshold(count: number): any[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: [{ type: 'text', text: `Message ${i}: ${'x'.repeat(200)}` }],
    timestamp: now - (count - i) * 1000,
  }));
}

// ---------------------------------------------------------------------------
// Mock ExtensionAPI
// ---------------------------------------------------------------------------

interface MockHandler {
  event: string;
  handler: (...args: any[]) => any;
}

interface MockTool {
  name: string;
  label: string;
  description: string;
  execute: (...args: any[]) => any;
}

export function createMockExtensionAPI() {
  const handlers: MockHandler[] = [];
  const tools: MockTool[] = [];

  return {
    api: {
      on(event: string, handler: (...args: any[]) => any) {
        handlers.push({ event, handler });
      },
      registerTool(tool: any) {
        tools.push(tool);
      },
    },
    handlers,
    tools,
    getHandler(event: string) {
      return handlers.find(h => h.event === event)?.handler;
    },
    getTool(name: string) {
      return tools.find(t => t.name === name);
    },
  };
}

export function createMockContext(sessionId: string) {
  return {
    sessionManager: {
      getSessionId: () => sessionId,
    },
    ui: {
      notify: vi.fn(),
      setStatus: vi.fn(),
    },
  };
}
