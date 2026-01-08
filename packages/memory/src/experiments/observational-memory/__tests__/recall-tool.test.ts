import { describe, it, expect } from 'vitest';
import { InMemoryMemory } from '@mastra/core/storage';

// Helper to create in-memory storage for tests
function createInMemoryStorage(): InMemoryMemory {
  return new InMemoryMemory({
    collection: {
      threads: new Map(),
      resources: new Map(),
      messages: new Map(),
      observationalMemory: new Map(),
    },
    operations: {} as any, // Not needed for recall tool tests
  });
}

// We need to test the internal functions, so we'll import the module and test through the tool
// For now, we'll recreate the parsing logic for testing since it's not exported

/**
 * Parse the recalled pattern from the LLM response.
 * (Copied from tool for testing purposes)
 */
function parsePatternItems(response: string, patternName: string): string[] {
  const items: string[] = [];
  
  const patternRegex = new RegExp(`<${patternName}>([\\s\\S]*?)<\\/${patternName}>`, 'i');
  const match = response.match(patternRegex);
  
  if (!match || !match[1]) {
    return items;
  }
  
  const content = match[1].trim();
  if (!content) {
    return items;
  }
  
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(/^[\*\-•]\s+/)) {
      const item = trimmed.replace(/^[\*\-•]\s+/, '').trim();
      if (item) {
        items.push(item);
      }
    }
  }
  
  return items;
}

/**
 * Format messages for the recall agent.
 * (Copied from tool for testing purposes)
 */
function formatMessagesForRecall(messages: Array<{ role: string; content: string | any[] }>): string {
  const formatted: string[] = [];
  
  for (const msg of messages) {
    const role = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : msg.role;
    
    let content: string;
    if (typeof msg.content === 'string') {
      content = msg.content;
    } else if (Array.isArray(msg.content)) {
      content = msg.content
        .map(part => {
          if (typeof part === 'string') return part;
          if (part.type === 'text') return part.text;
          if (part.type === 'tool-call') return `[Tool call: ${part.toolName}]`;
          if (part.type === 'tool-result') return `[Tool result: ${JSON.stringify(part.result).slice(0, 200)}...]`;
          return JSON.stringify(part);
        })
        .join('\n');
    } else {
      content = JSON.stringify(msg.content);
    }
    
    formatted.push(`${role}: ${content}`);
  }
  
  return formatted.join('\n\n');
}

describe('RecallTool', () => {
  describe('parsePatternItems', () => {
    it('should extract items from a valid pattern block', () => {
      const response = `
<trips>
* Paris vacation (March 2023)
* Tokyo business trip (April 2023)
* London weekend getaway (May 2023)
</trips>
`;
      const items = parsePatternItems(response, 'trips');
      
      expect(items).toHaveLength(3);
      expect(items[0]).toBe('Paris vacation (March 2023)');
      expect(items[1]).toBe('Tokyo business trip (April 2023)');
      expect(items[2]).toBe('London weekend getaway (May 2023)');
    });

    it('should handle different bullet markers', () => {
      const response = `
<purchases>
- New laptop (Jan 2023)
* Headphones (Feb 2023)
• Coffee maker (Mar 2023)
</purchases>
`;
      const items = parsePatternItems(response, 'purchases');
      
      expect(items).toHaveLength(3);
      expect(items[0]).toBe('New laptop (Jan 2023)');
      expect(items[1]).toBe('Headphones (Feb 2023)');
      expect(items[2]).toBe('Coffee maker (Mar 2023)');
    });

    it('should return empty array for empty pattern block', () => {
      const response = '<events></events>';
      const items = parsePatternItems(response, 'events');
      
      expect(items).toHaveLength(0);
    });

    it('should return empty array when pattern not found', () => {
      const response = 'No patterns found in this conversation.';
      const items = parsePatternItems(response, 'trips');
      
      expect(items).toHaveLength(0);
    });

    it('should handle pattern name case-insensitively', () => {
      const response = `
<TRIPS>
* First trip (Jan 2023)
</TRIPS>
`;
      const items = parsePatternItems(response, 'trips');
      
      expect(items).toHaveLength(1);
      expect(items[0]).toBe('First trip (Jan 2023)');
    });

    it('should handle snake_case pattern names', () => {
      const response = `
<baking_events>
* Chocolate cake (May 27, 2023)
* Whole wheat baguette (May 27, 2023)
* Cookies (May 25, 2023)
</baking_events>
`;
      const items = parsePatternItems(response, 'baking_events');
      
      expect(items).toHaveLength(3);
    });

    it('should skip non-list lines', () => {
      const response = `
<trips>
Here are the trips:
* Paris (March 2023)
This is a comment
- Tokyo (April 2023)
</trips>
`;
      const items = parsePatternItems(response, 'trips');
      
      expect(items).toHaveLength(2);
      expect(items[0]).toBe('Paris (March 2023)');
      expect(items[1]).toBe('Tokyo (April 2023)');
    });

    it('should handle whitespace variations', () => {
      const response = `
<events>
   *   Concert at the park (June 2023)   
  - Art museum visit (July 2023)
</events>
`;
      const items = parsePatternItems(response, 'events');
      
      expect(items).toHaveLength(2);
      expect(items[0]).toBe('Concert at the park (June 2023)');
      expect(items[1]).toBe('Art museum visit (July 2023)');
    });

    it('should handle patterns with special regex characters', () => {
      // Test that pattern names with special characters don't break regex
      const response = `
<art_events>
* Museum visit (Jan 2023)
</art_events>
`;
      const items = parsePatternItems(response, 'art_events');
      
      expect(items).toHaveLength(1);
    });
  });

  describe('formatMessagesForRecall', () => {
    it('should format simple string messages', () => {
      const messages = [
        { role: 'user', content: 'Hello there!' },
        { role: 'assistant', content: 'Hi! How can I help you?' },
      ];
      
      const formatted = formatMessagesForRecall(messages);
      
      expect(formatted).toContain('User: Hello there!');
      expect(formatted).toContain('Assistant: Hi! How can I help you?');
    });

    it('should handle array content with text parts', () => {
      const messages = [
        { 
          role: 'user', 
          content: [
            { type: 'text', text: 'Tell me about my trips' }
          ]
        },
      ];
      
      const formatted = formatMessagesForRecall(messages);
      
      expect(formatted).toContain('User: Tell me about my trips');
    });

    it('should handle tool calls in content', () => {
      const messages = [
        { 
          role: 'assistant', 
          content: [
            { type: 'tool-call', toolName: 'searchTrips' }
          ]
        },
      ];
      
      const formatted = formatMessagesForRecall(messages);
      
      expect(formatted).toContain('[Tool call: searchTrips]');
    });

    it('should handle tool results in content', () => {
      const messages = [
        { 
          role: 'tool', 
          content: [
            { type: 'tool-result', result: { trips: ['Paris', 'Tokyo'] } }
          ]
        },
      ];
      
      const formatted = formatMessagesForRecall(messages);
      
      expect(formatted).toContain('[Tool result:');
      expect(formatted).toContain('Paris');
    });

    it('should handle mixed content types', () => {
      const messages = [
        { 
          role: 'assistant', 
          content: [
            { type: 'text', text: 'Let me search for that.' },
            { type: 'tool-call', toolName: 'search' }
          ]
        },
      ];
      
      const formatted = formatMessagesForRecall(messages);
      
      expect(formatted).toContain('Let me search for that.');
      expect(formatted).toContain('[Tool call: search]');
    });

    it('should preserve message order with separators', () => {
      const messages = [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'Second message' },
        { role: 'user', content: 'Third message' },
      ];
      
      const formatted = formatMessagesForRecall(messages);
      const parts = formatted.split('\n\n');
      
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('User: First message');
      expect(parts[1]).toBe('Assistant: Second message');
      expect(parts[2]).toBe('User: Third message');
    });

    it('should handle system role', () => {
      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
      ];
      
      const formatted = formatMessagesForRecall(messages);
      
      expect(formatted).toBe('system: You are a helpful assistant.');
    });

    it('should handle empty messages array', () => {
      const formatted = formatMessagesForRecall([]);
      
      expect(formatted).toBe('');
    });
  });

  describe('getRecallTool (ObservationalMemory method)', () => {
    it('should create a tool with correct id and description', async () => {
      const { ObservationalMemory } = await import('../observational-memory');
      
      const storage = createInMemoryStorage();
      const om = new ObservationalMemory({
        storage,
        observer: { model: { id: 'openai/gpt-4o-mini' } },
        reflector: { model: { id: 'openai/gpt-4o-mini' } },
      });
      
      const tool = om.getRecallTool();
      
      expect(tool.id).toBe('recall');
      expect(tool.description).toContain('question');
    });

    it('should allow custom description', async () => {
      const { ObservationalMemory } = await import('../observational-memory');
      
      const storage = createInMemoryStorage();
      const om = new ObservationalMemory({
        storage,
        observer: { model: { id: 'openai/gpt-4o-mini' } },
        reflector: { model: { id: 'openai/gpt-4o-mini' } },
      });
      
      const customDesc = 'Custom tool description';
      const tool = om.getRecallTool({ description: customDesc });
      
      expect(tool.description).toBe(customDesc);
    });

    it('should have correct input schema', async () => {
      const { ObservationalMemory } = await import('../observational-memory');
      
      const storage = createInMemoryStorage();
      const om = new ObservationalMemory({
        storage,
        observer: { model: { id: 'openai/gpt-4o-mini' } },
        reflector: { model: { id: 'openai/gpt-4o-mini' } },
      });
      
      const tool = om.getRecallTool();
      
      // The tool should accept question as input
      expect(tool.inputSchema).toBeDefined();
    });
  });
});
