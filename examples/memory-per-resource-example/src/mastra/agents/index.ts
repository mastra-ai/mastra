import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';

// Create LibSQL storage for persistent per-resource working memory
const storage = new LibSQLStore({
  url: 'file:./memory-demo.db',
});

export const memory = new Memory({
  storage,
  options: {
    lastMessages: 5,
    workingMemory: {
      enabled: true,
      scope: 'resource', // 🆕 NEW: Per-resource working memory!
      template: `# User Profile
- **Name**: 
- **Location**: 
- **Interests**: 
- **Preferences**: 
- **Goals**: 
- **Important Notes**: 
`,
    },
  },
});

export const assistantAgent = new Agent({
  name: 'Personal Assistant',
  instructions: `You are a helpful personal assistant with persistent memory across ALL conversations.

🆕 IMPORTANT: You have resource-scoped working memory! This means:
- Everything you learn about this user persists across ALL conversation threads
- Even if they start a completely new conversation, you'll remember them
- You should build up a comprehensive profile of the user over time

Always use <working_memory> tags to update what you know about the user:
- Their name and personal details
- Their interests and preferences  
- Their goals and what they're working on
- Any important context from previous conversations

When you first meet someone, ask for their name and learn about them. In subsequent conversations (even new threads), greet them by name and reference what you remember!`,
  model: openai('gpt-4o-mini'),
  memory,
});
