import { convertToModelMessages } from '@internal/ai-sdk-v5';
import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../index';
import { MessageList } from '../index';

describe('MessageList - Gemini Compatibility', () => {
  describe('aiV5.prompt() - Gemini message ordering requirements', () => {
    it('should ensure first non-system message is user when starting with assistant', () => {
      const list = new MessageList();

      // Simulate memory recall that starts with assistant
      list.add({ role: 'assistant', content: 'Previous response' }, 'memory');
      list.add({ role: 'user', content: 'Current input' }, 'input');

      const prompt = list.get.all.aiV5.prompt();

      // First non-system message should be user
      const firstNonSystem = prompt.find(m => m.role !== 'system');
      expect(firstNonSystem?.role).toBe('user');

      // The injected user message should come before the assistant
      expect(prompt[0].role).toBe('user');
      expect(prompt[0].content).toBe('.');
      expect(prompt[1].role).toBe('assistant');
    });

    it('should ensure first non-system message is user when system + assistant pattern', () => {
      const list = new MessageList();

      // Add system message
      list.addSystem('You are a helpful assistant');

      // Simulate memory that starts with assistant
      list.add({ role: 'assistant', content: 'Hello!' }, 'memory');
      list.add({ role: 'user', content: 'Hi there' }, 'input');

      const prompt = list.get.all.aiV5.prompt();

      expect(prompt[0].role).toBe('system');
      // Should inject user message after system, before assistant
      expect(prompt[1].role).toBe('user');
      expect(prompt[1].content).toBe('.');
      expect(prompt[2].role).toBe('assistant');
      expect(prompt[3].role).toBe('user');
    });

    it('should inject user when starting with assistant after system', () => {
      const list = new MessageList();

      list.addSystem('You are helpful');
      list.add({ role: 'assistant', content: 'Previous response' }, 'memory');

      const prompt = list.get.all.aiV5.prompt();

      expect(prompt).toHaveLength(3);
      expect(prompt[0].role).toBe('system');
      expect(prompt[1].role).toBe('user'); // Injected after system
      expect(prompt[1].content).toBe('.');
      expect(prompt[2].role).toBe('assistant');
    });

    it('should handle multiple system messages followed by assistant', () => {
      const list = new MessageList();

      list.addSystem('System instruction 1');
      list.addSystem('System instruction 2', 'tag1');
      list.add({ role: 'assistant', content: 'Ready to help' }, 'memory');

      const prompt = list.get.all.aiV5.prompt();

      expect(prompt).toHaveLength(4);
      expect(prompt[0].role).toBe('system');
      expect(prompt[1].role).toBe('system');
      expect(prompt[2].role).toBe('user'); // Injected after systems
      expect(prompt[3].role).toBe('assistant');
    });

    it('should not inject when already properly formatted', () => {
      const list = new MessageList();

      list.addSystem('System message');
      list.add({ role: 'user', content: 'Hello' }, 'input');
      list.add({ role: 'assistant', content: 'Hi' }, 'response');
      list.add({ role: 'user', content: 'How are you?' }, 'input');

      const prompt = list.get.all.aiV5.prompt();

      // Should not inject any messages
      expect(prompt).toHaveLength(4);
      expect(prompt[0].role).toBe('system');
      expect(prompt[1].role).toBe('user');
      expect(prompt[2].role).toBe('assistant');
      expect(prompt[3].role).toBe('user');

      // No injected '.' messages
      expect(prompt.filter(m => m.content === '.').length).toBe(0);
    });

    it('should throw error for empty message list', () => {
      const list = new MessageList();

      expect(() => list.get.all.aiV5.prompt()).toThrow(
        'This request does not contain any user or assistant messages. At least one user or assistant message is required to generate a response.',
      );
    });

    it('should throw error for system-only message list', () => {
      const list = new MessageList();
      list.addSystem('You are a helpful assistant');

      expect(() => list.get.all.aiV5.prompt()).toThrow(
        'This request does not contain any user or assistant messages. At least one user or assistant message is required to generate a response.',
      );
    });
  });

  describe('aiV5.llmPrompt() - Gemini message ordering requirements', () => {
    it('should ensure first non-system message is user in llmPrompt', async () => {
      const list = new MessageList();

      list.addSystem('System message');
      list.add({ role: 'assistant', content: 'Previous response' }, 'memory');
      list.add({ role: 'user', content: 'Current input' }, 'input');

      const llmPrompt = await list.get.all.aiV5.llmPrompt();

      expect(llmPrompt[0].role).toBe('system');
      // Should inject user message after system
      expect(llmPrompt[1].role).toBe('user');
      expect(llmPrompt[1].content).toEqual([{ type: 'text', text: '.' }]);
      expect(llmPrompt[2].role).toBe('assistant');
      expect(llmPrompt[3].role).toBe('user');
    });

    it('should inject user after system when starting with assistant in llmPrompt', async () => {
      const list = new MessageList();

      list.addSystem('You are helpful');
      list.add({ role: 'assistant', content: 'Ready' }, 'memory');

      const llmPrompt = await list.get.all.aiV5.llmPrompt();

      expect(llmPrompt).toHaveLength(3);
      expect(llmPrompt[0].role).toBe('system');
      expect(llmPrompt[1].role).toBe('user'); // Injected after system
      expect(llmPrompt[2].role).toBe('assistant');
    });

    it('should throw error for empty message list in llmPrompt', async () => {
      const list = new MessageList();

      await expect(list.get.all.aiV5.llmPrompt()).rejects.toThrow(
        'This request does not contain any user or assistant messages. At least one user or assistant message is required to generate a response.',
      );
    });

    it('should throw error for system-only message list in llmPrompt', async () => {
      const list = new MessageList();
      list.addSystem('You are a helpful assistant');

      await expect(list.get.all.aiV5.llmPrompt()).rejects.toThrow(
        'This request does not contain any user or assistant messages. At least one user or assistant message is required to generate a response.',
      );
    });
  });

  describe('data-* parts filtering - Issue #12363', () => {
    // After using writer.custom() in a tool, custom data parts get stored in conversation history.
    // When sending messages to Gemini, these data-* parts must be filtered out because Gemini
    // doesn't recognize them and will fail with:
    // "Unable to submit request because it must include at least one parts field"

    it('should filter out data-* parts from aiV5.prompt() for Gemini compatibility', () => {
      const list = new MessageList();

      list.add({ role: 'user', content: 'Create a chart for me' }, 'input');

      // Simulate assistant response with custom data parts from writer.custom()
      const assistantWithDataParts: MastraDBMessage = {
        id: 'msg-with-data',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            { type: 'text', text: 'Here is your chart:' },
            {
              type: 'data-chart',
              data: {
                chartType: 'bar',
                values: [10, 20, 30],
              },
            } as any,
          ],
          content: 'Here is your chart:',
        },
      };

      list.add(assistantWithDataParts, 'response');
      list.add({ role: 'user', content: 'Can you modify the chart?' }, 'input');

      const prompt = list.get.all.aiV5.prompt();

      // Find the assistant message in the prompt
      const assistantMsg = prompt.find(m => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();

      // The assistant message content should NOT contain data-* parts
      if (typeof assistantMsg!.content !== 'string') {
        const hasDataPart = assistantMsg!.content.some((p: any) => p.type?.startsWith('data-'));
        expect(hasDataPart).toBe(false);
      }

      // Text part should still be present
      if (typeof assistantMsg!.content !== 'string') {
        const hasTextPart = assistantMsg!.content.some((p: any) => p.type === 'text');
        expect(hasTextPart).toBe(true);
      }
    });

    it('should filter out data-* parts from aiV5.llmPrompt() for Gemini compatibility', async () => {
      const list = new MessageList();

      list.add({ role: 'user', content: 'Show me progress' }, 'input');

      // Simulate assistant response with multiple data parts
      const assistantWithDataParts: MastraDBMessage = {
        id: 'msg-with-progress',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            { type: 'text', text: 'Processing...' },
            {
              type: 'data-progress',
              data: { percent: 50, status: 'in-progress' },
            } as any,
            {
              type: 'data-file-reference',
              data: { fileId: 'file-123' },
            } as any,
          ],
          content: 'Processing...',
        },
      };

      list.add(assistantWithDataParts, 'response');
      list.add({ role: 'user', content: 'What is the status?' }, 'input');

      const llmPrompt = await list.get.all.aiV5.llmPrompt();

      // Find the assistant message in the prompt
      const assistantMsg = llmPrompt.find(m => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();

      // The assistant message content should NOT contain any data-* parts
      if (typeof assistantMsg!.content !== 'string') {
        const dataPartsCount = assistantMsg!.content.filter((p: any) => p.type?.startsWith('data-')).length;
        expect(dataPartsCount).toBe(0);
      }
    });

    it('should preserve data-* parts in UI messages but filter from model messages', () => {
      const list = new MessageList();

      list.add({ role: 'user', content: 'Test' }, 'input');

      const assistantWithDataParts: MastraDBMessage = {
        id: 'msg-test',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Response' }, { type: 'data-custom', data: { key: 'value' } } as any],
          content: 'Response',
        },
      };

      list.add(assistantWithDataParts, 'response');

      // UI messages should preserve data-* parts (for UI rendering)
      const uiMessages = list.get.all.aiV5.ui();
      const uiAssistant = uiMessages.find(m => m.role === 'assistant');
      expect(uiAssistant).toBeDefined();
      const hasDataPartInUI = uiAssistant!.parts.some((p: any) => p.type?.startsWith('data-'));
      expect(hasDataPartInUI).toBe(true);

      // Model messages (for LLM) should NOT have data-* parts
      const modelMessages = list.get.all.aiV5.model();
      const modelAssistant = modelMessages.find(m => m.role === 'assistant');
      expect(modelAssistant).toBeDefined();

      if (typeof modelAssistant!.content !== 'string') {
        const dataPartsInModel = modelAssistant!.content.filter((p: any) => p.type?.startsWith('data-'));
        // Data-* parts should be filtered out by AIV5.convertToModelMessages
        expect(dataPartsInModel.length).toBe(0);
      }
    });

    it('should not remove messages that only have data-* parts (preserve empty text)', () => {
      const list = new MessageList();

      list.add({ role: 'user', content: 'Generate data' }, 'input');

      // Assistant responds with only custom data (no text)
      const assistantOnlyData: MastraDBMessage = {
        id: 'msg-only-data',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [{ type: 'data-result', data: { success: true } } as any],
          content: '',
        },
      };

      list.add(assistantOnlyData, 'response');
      list.add({ role: 'user', content: 'Next question' }, 'input');

      // The prompt should still be valid - either the message is removed or has empty text
      // What's important is that it doesn't crash Gemini with invalid parts
      const prompt = list.get.all.aiV5.prompt();

      // Verify no data-* parts exist in any message
      for (const msg of prompt) {
        if (msg.role !== 'system' && typeof msg.content !== 'string') {
          const hasDataPart = msg.content.some((p: any) => p.type?.startsWith('data-'));
          expect(hasDataPart).toBe(false);
        }
      }
    });

    it('AI SDK convertToModelMessages should filter out data-* parts', () => {
      // This test verifies the AI SDK behavior that we rely on
      const uiMessages = [
        {
          id: 'test-1',
          role: 'user' as const,
          parts: [{ type: 'text' as const, text: 'Hello' }],
        },
        {
          id: 'test-2',
          role: 'assistant' as const,
          parts: [
            { type: 'text' as const, text: 'Here is your data:' },
            { type: 'data-custom', data: { key: 'value' } } as any,
          ],
        },
      ];

      const modelMessages = convertToModelMessages(uiMessages);

      // Find the assistant message
      const assistantModel = modelMessages.find(m => m.role === 'assistant');
      expect(assistantModel).toBeDefined();

      // Verify data-* parts are filtered out by the AI SDK
      if (typeof assistantModel!.content !== 'string') {
        const hasDataPart = assistantModel!.content.some((p: any) => p.type?.startsWith('data-'));
        expect(hasDataPart).toBe(false);
      }
    });

    it('should not produce messages with empty content arrays - Issue #12363', () => {
      // Issue #12363: After using writer.custom() in a tool, subsequent messages fail with Gemini
      // Error: "Unable to submit request because it must include at least one parts field"
      //
      // Root cause: When a message contains ONLY data-* parts (custom parts from writer.custom()),
      // the AI SDK's convertToModelMessages creates a message with an empty content array.
      // Gemini rejects messages with empty content arrays.
      //
      // Fix: sanitizeV5UIMessages now filters out data-* parts before conversion,
      // and messages with only data-* parts are removed entirely.
      const list = new MessageList();

      list.add({ role: 'user', content: 'Run the tool' }, 'input');

      // Simulate assistant response with ONLY data-* parts (typical when writer.custom() is used without text)
      const assistantOnlyDataParts: MastraDBMessage = {
        id: 'assistant-with-only-data',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            { type: 'data-progress', data: { percent: 50 } } as any,
            { type: 'data-chart', data: { chartType: 'bar' } } as any,
          ],
          content: '', // No text content
        },
      };

      list.add(assistantOnlyDataParts, 'response');
      list.add({ role: 'user', content: 'Continue the conversation' }, 'input');

      // Get the prompt that would be sent to Gemini
      const prompt = list.get.all.aiV5.prompt();

      // CRITICAL: No messages should have empty content arrays
      // This would cause: "Unable to submit request because it must include at least one parts field"
      for (const msg of prompt) {
        if (typeof msg.content !== 'string') {
          expect(msg.content.length).toBeGreaterThan(0);
        }
      }

      // The assistant message with only data-* parts should be removed entirely
      // (only user messages should remain)
      expect(prompt.filter(m => m.role === 'assistant').length).toBe(0);
      expect(prompt.filter(m => m.role === 'user').length).toBe(2);
    });

    it('AI SDK convertToModelMessages produces empty content arrays for data-only messages (documents SDK behavior)', () => {
      // This test DOCUMENTS the AI SDK behavior that we work around.
      // The AI SDK's convertToModelMessages produces empty content arrays
      // for messages that have only data-* parts.
      // Our fix in sanitizeV5UIMessages filters these parts BEFORE calling convertToModelMessages.
      const uiMessages = [
        {
          id: 'test-1',
          role: 'user' as const,
          parts: [{ type: 'text' as const, text: 'Hello' }],
        },
        {
          id: 'test-2',
          role: 'assistant' as const,
          parts: [
            { type: 'data-progress', data: { percent: 50 } } as any,
            { type: 'data-result', data: { success: true } } as any,
          ],
        },
        {
          id: 'test-3',
          role: 'user' as const,
          parts: [{ type: 'text' as const, text: 'Next message' }],
        },
      ];

      const modelMessages = convertToModelMessages(uiMessages);

      // Find the assistant message (which had only data-* parts)
      const assistantMsg = modelMessages.find(m => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();

      // The AI SDK produces an empty content array
      // This is why we filter data-* parts in sanitizeV5UIMessages before conversion
      expect(typeof assistantMsg!.content).not.toBe('string');
      expect((assistantMsg!.content as any[]).length).toBe(0);
    });

    it('should preserve data-* parts in DB/UI but filter from model/prompt messages', () => {
      const list = new MessageList();

      // Add user message
      list.add({ role: 'user', content: 'Run the tool' }, 'input');

      // Add assistant message with mixed parts (text + data-*)
      const mixedAssistant: MastraDBMessage = {
        id: 'mixed-msg',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Processing...' }, { type: 'data-progress', data: { percent: 50 } } as any],
          content: 'Processing...',
        },
      };
      list.add(mixedAssistant, 'response');

      // Add assistant message with ONLY data-* parts
      const dataOnlyAssistant: MastraDBMessage = {
        id: 'data-only-msg',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [{ type: 'data-chart', data: { type: 'bar' } } as any],
          content: '',
        },
      };
      list.add(dataOnlyAssistant, 'response');

      // 1. DB storage should preserve ALL parts including data-*
      const dbMessages = list.get.all.db();
      const dbAssistant = dbMessages.find(m => m.id === 'mixed-msg');
      expect(dbAssistant?.content.parts?.map(p => p.type)).toContain('data-progress');

      // 2. UI messages should preserve ALL parts (needed for frontend rendering)
      const uiMessages = list.get.all.aiV5.ui();
      const uiAssistant = uiMessages.find(m => m.id === 'mixed-msg');
      expect(uiAssistant?.parts.map(p => p.type)).toContain('data-progress');

      // 3. Model messages should NOT have data-* parts
      const modelMessages = list.get.all.aiV5.model();
      for (const msg of modelMessages) {
        if (msg.role === 'assistant' && typeof msg.content !== 'string') {
          const hasDataPart = msg.content.some((p: any) => p.type?.startsWith('data-'));
          expect(hasDataPart).toBe(false);
        }
      }

      // 4. Prompt messages should NOT have data-* parts or empty content arrays
      const promptMessages = list.get.all.aiV5.prompt();
      for (const msg of promptMessages) {
        if (typeof msg.content !== 'string') {
          // No data-* parts
          const hasDataPart = msg.content.some((p: any) => p.type?.startsWith('data-'));
          expect(hasDataPart).toBe(false);
          // No empty content arrays
          expect(msg.content.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('empty reasoning parts filtering - Issue #12980', () => {
    // Gemini with reasoning tokens can produce empty reasoning parts: {"type":"reasoning","text":""}
    // When stored in memory and sent back to Gemini on the next turn, Gemini rejects with:
    // "Unable to submit request because it must include at least one parts field"
    // Empty reasoning parts should be filtered out, similar to how empty text parts are handled.

    it('should filter out empty reasoning parts from assistant messages in prompt()', () => {
      const list = new MessageList();

      list.add({ role: 'user', content: 'Hello' }, 'input');

      // Simulate assistant response with empty reasoning part (from Gemini with reasoning tokens)
      const assistantWithEmptyReasoning: MastraDBMessage = {
        id: 'msg-empty-reasoning',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            {
              type: 'reasoning',
              reasoning: '',
              details: [{ type: 'text', text: '' }],
            },
            { type: 'text', text: 'Hello! How can I help you?' },
          ],
          content: 'Hello! How can I help you?',
        },
      };

      list.add(assistantWithEmptyReasoning, 'memory');
      list.add({ role: 'user', content: 'Follow up question' }, 'input');

      const prompt = list.get.all.aiV5.prompt();

      // Find the assistant message
      const assistantMsg = prompt.find(m => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();

      // Empty reasoning parts should be filtered out
      if (typeof assistantMsg!.content !== 'string') {
        const reasoningParts = assistantMsg!.content.filter((p: any) => p.type === 'reasoning');
        for (const rp of reasoningParts) {
          // No reasoning part should have empty text
          expect((rp as any).text).not.toBe('');
        }
      }

      // Text part should still be present
      if (typeof assistantMsg!.content !== 'string') {
        const textParts = assistantMsg!.content.filter((p: any) => p.type === 'text');
        expect(textParts.length).toBeGreaterThan(0);
      }
    });

    it('should filter out empty reasoning parts from llmPrompt()', async () => {
      const list = new MessageList();

      list.add({ role: 'user', content: 'Hello' }, 'input');

      const assistantWithEmptyReasoning: MastraDBMessage = {
        id: 'msg-empty-reasoning-2',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            {
              type: 'reasoning',
              reasoning: '',
              details: [{ type: 'text', text: '' }],
            },
            { type: 'text', text: 'Here is my response' },
          ],
          content: 'Here is my response',
        },
      };

      list.add(assistantWithEmptyReasoning, 'memory');
      list.add({ role: 'user', content: 'Follow up' }, 'input');

      const llmPrompt = await list.get.all.aiV5.llmPrompt();

      const assistantMsg = llmPrompt.find(m => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();

      if (typeof assistantMsg!.content !== 'string') {
        const reasoningParts = assistantMsg!.content.filter((p: any) => p.type === 'reasoning');
        for (const rp of reasoningParts) {
          expect((rp as any).text).not.toBe('');
        }
      }
    });

    it('should remove assistant message entirely when only part is empty reasoning', () => {
      const list = new MessageList();

      list.add({ role: 'user', content: 'Hello' }, 'input');

      // Simulate the exact scenario from the issue: {"role":"assistant","content":[{"type":"reasoning","text":""}]}
      const assistantOnlyEmptyReasoning: MastraDBMessage = {
        id: 'msg-only-empty-reasoning',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            {
              type: 'reasoning',
              reasoning: '',
              details: [{ type: 'text', text: '' }],
            },
          ],
          content: '',
        },
      };

      list.add(assistantOnlyEmptyReasoning, 'memory');
      list.add({ role: 'user', content: 'Follow up question' }, 'input');

      const prompt = list.get.all.aiV5.prompt();

      // No messages should have empty content arrays (Gemini would reject)
      for (const msg of prompt) {
        if (typeof msg.content !== 'string') {
          expect(msg.content.length).toBeGreaterThan(0);
          // No empty reasoning parts
          const emptyReasoningParts = msg.content.filter(
            (p: any) => p.type === 'reasoning' && (!p.text || p.text === ''),
          );
          expect(emptyReasoningParts.length).toBe(0);
        }
      }
    });

    it('should preserve non-empty reasoning parts', () => {
      const list = new MessageList();

      list.add({ role: 'user', content: 'Hello' }, 'input');

      const assistantWithReasoning: MastraDBMessage = {
        id: 'msg-with-reasoning',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            {
              type: 'reasoning',
              reasoning: '',
              details: [{ type: 'text', text: 'Let me think about this...' }],
            },
            { type: 'text', text: 'Here is my answer' },
          ],
          content: 'Here is my answer',
        },
      };

      list.add(assistantWithReasoning, 'memory');
      list.add({ role: 'user', content: 'Thanks' }, 'input');

      const prompt = list.get.all.aiV5.prompt();

      const assistantMsg = prompt.find(m => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();

      // Non-empty reasoning should be preserved
      if (typeof assistantMsg!.content !== 'string') {
        const reasoningParts = assistantMsg!.content.filter((p: any) => p.type === 'reasoning');
        expect(reasoningParts.length).toBe(1);
        expect((reasoningParts[0] as any).text).toBe('Let me think about this...');
      }
    });
  });

  describe('Agent Network scenarios', () => {
    it('should handle agent network memory pattern correctly', () => {
      const list = new MessageList();

      // Simulate agent network with memory
      list.addSystem('Agent coordinator system prompt');

      // Memory from previous interactions (starts with assistant)
      list.add(
        {
          role: 'assistant',
          content: 'Previous agent response from memory',
        },
        'memory',
      );

      list.add(
        {
          role: 'user',
          content: 'Previous user message from memory',
        },
        'memory',
      );

      list.add(
        {
          role: 'assistant',
          content: 'Another previous response',
        },
        'memory',
      );

      // Current interaction
      list.add(
        {
          role: 'user',
          content: 'Current user input',
        },
        'input',
      );

      const prompt = list.get.all.aiV5.prompt();

      // Verify Gemini requirements
      expect(prompt[0].role).toBe('system');

      // First non-system should be user (injected if needed)
      const firstNonSystemIndex = prompt.findIndex(m => m.role !== 'system');
      expect(prompt[firstNonSystemIndex].role).toBe('user');

      // Last should be user
      expect(prompt[prompt.length - 1].role).toBe('user');
    });
  });
});
