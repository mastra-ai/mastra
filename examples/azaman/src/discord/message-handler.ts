import { PgMemory } from '@mastra/memory';
import { v4 as uuidv4 } from 'uuid';

import { loadDocs, mastra } from '@/mastra';

import { DiscordMessage } from './types';

// Initialize memory
const memory = new PgMemory({
  connectionString: process.env.DB_URL!,
});

// Initialize tables
(async () => {
  try {
    await memory.ensureTablesExist();
    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database tables:', error);
  }
})();

// Helper function to generate responses
const generateResponse = async (question: string, threadId: string) => {
  const agent = mastra.getAgent('generateAnswerAgentWithMemory');

  // Generate response
  const completion = await agent.generate(question);

  // Store the interaction in memory
  await memory.addMessage({
    threadId,
    content: question,
    role: 'user',
    type: 'text',
  });

  await memory.addMessage({
    threadId,
    content: completion.text,
    role: 'assistant',
    type: 'text',
  });

  return completion.text;
};

// Helper to check if message is in a thread
// const isInThread = (message: DiscordMessage): boolean => {
//   return !!message.thread_id || !!message.message_reference;
// };

// // Helper to get thread ID
// const getThreadId = (message: DiscordMessage): string => {
//   return message.thread_id || message.message_reference?.channel_id || message.channel_id;
// };

// Handle incoming Discord messages
export const handleMessage = async (message: DiscordMessage) => {
  // Skip bot messages
  if (message.author?.bot) return;

  // If not in a thread, only respond to mentions
  // If in a thread, respond to all messages
  if (!message.thread_id && !message.mentions?.some(mention => mention.id === process.env.DISCORD_APPLICATION_ID)) {
    return;
  }

  // Get the question (remove mention if present)
  const question = message.mentions?.length ? message.content.replace(/<@!\d+>/g, '').trim() : message.content.trim();

  // Skip empty messages
  if (!question) return;

  try {
    // Get or create thread for this conversation
    const discordThreadId = message.thread_id || message.channel_id;
    const threadId = uuidv4(); // Generate a new UUID for the thread

    await loadDocs();

    // Try to find existing thread by Discord thread ID in metadata
    const existingThreads = await memory.getThreadsByResourceId({ resourceid: `discord-${message.channel_id}` });
    console.log('existingThreads', existingThreads, '==============');
    let thread = existingThreads.find(t => t.metadata?.discordThreadId === discordThreadId);
    console.log('thread', thread, '==============');

    if (!thread) {
      console.log('creating new thread');
      thread = await memory.createThread({
        threadId,
        title: `Discord Thread ${discordThreadId}`,
        resourceid: `discord-${message.channel_id}`,
        metadata: {
          channelId: message.channel_id,
          guildId: message.guild_id,
          discordThreadId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    }

    console.log('thread', thread, '==============');

    // Generate response using thread UUID for context
    const answer = await generateResponse(question, thread.id);

    // If not already in a thread, create one
    let targetChannelId = message.channel_id;

    if (!message.thread_id) {
      // Create a new thread
      const threadResponse = await fetch(`https://discord.com/api/v10/channels/${message.channel_id}/messages/${message.id}/threads`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `Chat: ${question.slice(0, 50)}...`, // Use first 50 chars of question as thread name
          auto_archive_duration: 1440, // Archive after 24 hours of inactivity
        }),
      });

      if (!threadResponse.ok) {
        throw new Error('Failed to create thread');
      }

      const threadData = await threadResponse.json();
      targetChannelId = threadData.id;

      // Update thread metadata with new Discord thread ID
      await memory.updateThread(thread.id, thread.title || '', {
        ...thread.metadata,
        discordThreadId: targetChannelId,
      });
    } else {
      targetChannelId = message.thread_id;
    }

    // Send the response in the thread
    await fetch(`https://discord.com/api/v10/channels/${targetChannelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: answer,
      }),
    });
  } catch (error) {
    console.error('Error processing message:', error);

    // Send error message in the original channel
    await fetch(`https://discord.com/api/v10/channels/${message.channel_id}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: "I'm sorry, I encountered an error while processing your question. Please try again later.",
        message_reference: {
          message_id: message.id,
          channel_id: message.channel_id,
          guild_id: message.guild_id,
        },
      }),
    });
  }
};
