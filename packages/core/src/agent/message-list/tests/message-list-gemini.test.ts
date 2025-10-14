import { describe, expect, it } from 'vitest';
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

    it('should ensure last message is user when ending with assistant', () => {
      const list = new MessageList();

      list.add({ role: 'user', content: 'Hello' }, 'input');
      list.add({ role: 'assistant', content: 'Hi there' }, 'response');

      const prompt = list.get.all.aiV5.prompt();

      // Last message should be user
      const lastMessage = prompt[prompt.length - 1];
      expect(lastMessage.role).toBe('user');
      expect(lastMessage.content).toBe('.');
    });

    it('should ensure last message is user when ending with tool', () => {
      const list = new MessageList();

      list.add({ role: 'user', content: 'What is the weather?' }, 'input');
      list.add(
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'get_weather',
              args: { location: 'London' },
            },
          ],
        },
        'response',
      );
      list.add(
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'get_weather',
              result: 'Sunny',
            },
          ],
        },
        'response',
      );

      const prompt = list.get.all.aiV5.prompt();

      // Last message should be user
      const lastMessage = prompt[prompt.length - 1];
      expect(lastMessage.role).toBe('user');
      expect(lastMessage.content).toBe('.');
    });

    it('should handle both first and last message requirements', () => {
      const list = new MessageList();

      list.addSystem('You are helpful');
      // Starts with assistant (needs user injection at start)
      list.add({ role: 'assistant', content: 'Previous response' }, 'memory');
      // Ends with assistant (needs user injection at end)

      const prompt = list.get.all.aiV5.prompt();

      expect(prompt[0].role).toBe('system');
      expect(prompt[1].role).toBe('user'); // Injected at start
      expect(prompt[1].content).toBe('.');
      expect(prompt[2].role).toBe('assistant');
      expect(prompt[3].role).toBe('user'); // Injected at end
      expect(prompt[3].content).toBe('.');
    });

    it('should handle multiple system messages followed by assistant', () => {
      const list = new MessageList();

      list.addSystem('System instruction 1');
      list.addSystem('System instruction 2', 'tag1');
      list.add({ role: 'assistant', content: 'Ready to help' }, 'memory');

      const prompt = list.get.all.aiV5.prompt();

      // Should have: system, system, user (injected), assistant, user (injected)
      expect(prompt[0].role).toBe('system');
      expect(prompt[1].role).toBe('system');
      expect(prompt[2].role).toBe('user'); // Injected after systems
      expect(prompt[3].role).toBe('assistant');
      expect(prompt[4].role).toBe('user'); // Injected at end
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

    it('should handle empty message list', () => {
      const list = new MessageList();

      const prompt = list.get.all.aiV5.prompt();

      // Should inject a single user message
      expect(prompt).toHaveLength(1);
      expect(prompt[0].role).toBe('user');
      expect(prompt[0].content).toBe('.');
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

    it('should ensure last message is user in llmPrompt', async () => {
      const list = new MessageList();

      list.add({ role: 'user', content: 'Hello' }, 'input');
      list.add({ role: 'assistant', content: 'Hi there' }, 'response');

      const llmPrompt = await list.get.all.aiV5.llmPrompt();

      // Last message should be user
      const lastMessage = llmPrompt[llmPrompt.length - 1];
      expect(lastMessage.role).toBe('user');
      expect(lastMessage.content).toEqual([{ type: 'text', text: '.' }]);
    });

    it('should handle both requirements in llmPrompt', async () => {
      const list = new MessageList();

      list.addSystem('You are helpful');
      list.add({ role: 'assistant', content: 'Ready' }, 'memory');

      const llmPrompt = await list.get.all.aiV5.llmPrompt();

      expect(llmPrompt[0].role).toBe('system');
      expect(llmPrompt[1].role).toBe('user'); // Injected after system
      expect(llmPrompt[2].role).toBe('assistant');
      expect(llmPrompt[3].role).toBe('user'); // Injected at end
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
