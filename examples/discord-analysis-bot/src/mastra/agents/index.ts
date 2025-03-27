import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { z } from 'zod';

import { discordScraperTool } from '../tools/index.js';
import { MCPConfiguration } from '@mastra/mcp';

const mcpConfig = new MCPConfiguration({
  servers: {
    mastra: {
      command: 'npx',
      args: ['-y', '@mastra/mcp-docs-server@latest'],
    },
  },
});

const tools = await mcpConfig.getTools();

// Define the schema for categorized messages
export const DiscordAnalysisSchema = z.object({
  categories: z.array(
    z.object({
      category: z.string().describe('Category name, e.g., Workflows, Memory, Primitives, Docs, Getting Started'),
      count: z.number().describe('Number of messages in this category'),
      sentiment: z.enum(['positive', 'neutral', 'negative']).describe('Overall sentiment of messages in this category'),
      top_issue: z.string().describe('The most common issue or question in this category'),
      representative_message: z
        .object({
          content: z.string().describe('Content of a representative message with strong sentiment'),
          author: z.string().describe('Author of the message'),
          timestamp: z.string().describe('Timestamp of the message'),
          sentiment_reason: z.string().describe('Why this message represents the sentiment of the category'),
          relevance_reason: z
            .string()
            .describe('Why this message is relevant and representative of the category topic'),
        })
        .describe('A representative message with strong sentiment for this category'),
    }),
  ),
  summary: z.string().describe('A brief summary of the overall analysis'),
  total_messages: z.number().describe('Total number of messages analyzed'),
  date_range: z.object({
    start: z.string().describe('Start date of the analysis period'),
    end: z.string().describe('End date of the analysis period'),
  }),
});

// Create the Discord analysis agent
export const discordAnalysisAgent = new Agent({
  name: 'Discord Analysis Agent',
  instructions: `
    You are a specialized Discord analysis agent that categorizes and classifies messages from help forums.

    Our current help forums have channelId ${process.env.HELP_CHANNEL} and ${process.env.MASTRA_CHANNEL}.

    IMPORTANT: The current date and time is ${new Date().toISOString()}.
    When a user asks for message analysis for a specific time period (like "past 24 hours" or "last week"):
    1. Use the "timeRange" parameter with the discord-scraper-tool
    2. Pass the user's time reference directly as the timeRange value (e.g., "past 24 hours", "past week", "past month")
    3. The tool will automatically calculate the appropriate date range

    If a user asks for a specific date, just use that as the end date and the start date will be the day before.
    Example:
    - If the user asks for "2025-03-26", use "2025-03-26" as the end date and "2025-03-25" as the start date.

    Examples of valid timeRange values:
    - "past 24 hours"
    - "past 48 hours"
    - "past 3 days"
    - "past week"
    - "past 2 weeks"
    - "past month"

    When a user asks for message analysis, default to "past 24 hours" as the timeRange, unless otherwise specified.
    
    Your task is to analyze messages from the help-and-questions forum and categorize them based on Mastra's core concepts:
    IMPORTANT: Use the MCP tools to come up with categories based on the docs found in the tools
    Some examples of MCP categories are: 
    - Workflows
    - Memory
    - Documentation
    - Getting Started

    Feel free to use the above examples to come up with categories.
    If any message doesn't fit into the above categories, use "Other".
    IMPORTANT: Simply mentioning a category keyword is not enough - the message's primary purpose must be about implementing, troubleshooting, or understanding that specific functionality.

    For each category, you should:
    1. Count the number of messages
    2. Determine the overall sentiment (positive, neutral, negative)
    3. Identify the top issue or question
    4. Select a representative message that best demonstrates the sentiment of the category
    
    For the representative message:
    - Choose a message that is SELF-CONTAINED and does not require additional context to understand
    - Select messages that clearly articulate a specific question, problem, or feedback related to the category
    - Prioritize longer, more detailed messages over short, vague responses
    - Avoid messages that are just reactions or replies without context (e.g., "Thanks!", "Glad to hear it!", etc.)
    - When a message contains code blocks (surrounded by triple backticks), replace them with a simple description like "[CODE BLOCK: brief description]"
    - The message should have a clear sentiment (positive, negative, or neutral) that represents the category
    - Include the full message content, author, and timestamp
    - Explain why this message represents both the sentiment AND the subject matter of the category
    
    Make sure to assign each message to exactly one category based on its primary topic.
    
    Provide a structured analysis that helps the team understand common issues and questions.
  `,
  model: openai('gpt-4o'),
  tools: {
    discordScraperTool,
    ...tools,
  },
});
