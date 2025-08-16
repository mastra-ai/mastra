import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const slackMessageSchema = z.object({
  text: z.string(),
  user: z.string(),
  timestamp: z.string(),
  channel: z.string(),
  thread_ts: z.string().optional(),
});

const searchResultSchema = z.object({
  messages: z.array(slackMessageSchema),
  totalCount: z.number(),
  channel: z.string(),
  query: z.string(),
});

const summarySchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()),
  actionItems: z.array(z.string()),
  decisions: z.array(z.string()),
  participants: z.array(z.string()),
  timeframe: z.string(),
  messageCount: z.number(),
});

const searchSlackMessages = createStep({
  id: 'search-slack-messages',
  description: 'Search for Slack messages using the external Slack MCP server',
  inputSchema: z.object({
    query: z.string().describe('Search query for Slack messages'),
    channel: z.string().optional().describe('Specific channel to search in'),
    dateRange: z.object({
      start: z.string().optional(),
      end: z.string().optional(),
    }).optional().describe('Date range for the search'),
    user: z.string().optional().describe('Filter by specific user'),
    limit: z.number().optional().describe('Maximum number of messages to return'),
  }),
  outputSchema: searchResultSchema,
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error('Search parameters not provided');
    }

    const agent = mastra?.getAgent('slackAgent');
    if (!agent) {
      throw new Error('Slack agent not found');
    }

    // Use the Slack agent to search messages via MCP tools
    const searchPrompt = `
      Search for Slack messages with the following parameters:
      - Query: "${inputData.query}"
      ${inputData.channel ? `- Channel: ${inputData.channel}` : ''}
      ${inputData.user ? `- User: ${inputData.user}` : ''}
      ${inputData.dateRange?.start ? `- Start date: ${inputData.dateRange.start}` : ''}
      ${inputData.dateRange?.end ? `- End date: ${inputData.dateRange.end}` : ''}
      ${inputData.limit ? `- Limit: ${inputData.limit} messages` : ''}
      
      Please search for messages matching these criteria and return the results.
    `;

    const response = await agent.stream([
      {
        role: 'user',
        content: searchPrompt,
      },
    ]);

    let searchResults = '';
    for await (const chunk of response.textStream) {
      searchResults += chunk;
    }

    // In a real implementation, you'd parse the actual response from the MCP tools
    // For now, we'll simulate a search result structure
    const mockMessages = [
      {
        text: `Discussing ${inputData.query} in our team meeting`,
        user: 'alice',
        timestamp: Math.floor(Date.now() / 1000 - 3600).toString(),
        channel: inputData.channel || '#general',
      },
      {
        text: `Follow-up on ${inputData.query} action items`,
        user: 'bob',
        timestamp: Math.floor(Date.now() / 1000 - 1800).toString(),
        channel: inputData.channel || '#general',
      },
    ];

    return {
      messages: mockMessages,
      totalCount: mockMessages.length,
      channel: inputData.channel || '#general',
      query: inputData.query,
    };
  },
});

const filterRelevantMessages = createStep({
  id: 'filter-relevant-messages',
  description: 'Filter and organize messages by relevance and thread relationships',
  inputSchema: searchResultSchema,
  outputSchema: z.object({
    filteredMessages: z.array(slackMessageSchema),
    messageThreads: z.array(z.object({
      threadId: z.string(),
      messages: z.array(slackMessageSchema),
    })),
    relevanceScore: z.number(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error('Search results not found');
    }

    const { messages } = inputData;

    // Group messages by thread
    const messageThreads: Record<string, typeof slackMessageSchema._type[]> = {};
    const standaloneMessages: typeof slackMessageSchema._type[] = [];

    messages.forEach((message) => {
      if (message.thread_ts) {
        if (!messageThreads[message.thread_ts]) {
          messageThreads[message.thread_ts] = [];
        }
        messageThreads[message.thread_ts].push(message);
      } else {
        standaloneMessages.push(message);
      }
    });

    // Convert to the expected format
    const threadArray = Object.entries(messageThreads).map(([threadId, threadMessages]) => ({
      threadId,
      messages: threadMessages.sort((a, b) => parseFloat(a.timestamp) - parseFloat(b.timestamp)),
    }));

    // Calculate relevance score based on message count and recency
    const now = Math.floor(Date.now() / 1000);
    const avgAge = messages.reduce((sum, msg) => sum + (now - parseFloat(msg.timestamp)), 0) / messages.length;
    const relevanceScore = Math.max(0, Math.min(1, (messages.length / 10) * (1 - avgAge / (7 * 24 * 3600))));

    return {
      filteredMessages: [...standaloneMessages, ...Object.values(messageThreads).flat()],
      messageThreads: threadArray,
      relevanceScore,
    };
  },
});

const generateSlackSummary = createStep({
  id: 'generate-slack-summary',
  description: 'Generate an AI-powered summary of the filtered Slack messages',
  inputSchema: z.object({
    filteredMessages: z.array(slackMessageSchema),
    messageThreads: z.array(z.object({
      threadId: z.string(),
      messages: z.array(slackMessageSchema),
    })),
    relevanceScore: z.number(),
  }),
  outputSchema: summarySchema,
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error('Filtered messages not found');
    }

    const agent = mastra?.getAgent('slackAgent');
    if (!agent) {
      throw new Error('Slack agent not found');
    }

    // Use the slack summary tool
    const summaryTool = mastra?.getTool('summarize-slack-messages');
    if (!summaryTool) {
      throw new Error('Slack summary tool not found');
    }

    const summaryResult = await summaryTool.execute({
      context: {},
      input: {
        messages: inputData.filteredMessages,
        summaryType: 'detailed',
      },
    });

    return summaryResult as typeof summarySchema._type;
  },
});

const slackWorkflow = createWorkflow({
  id: 'slack-message-search-summary',
  inputSchema: z.object({
    query: z.string().describe('Search query for Slack messages'),
    channel: z.string().optional().describe('Specific channel to search in'),
    dateRange: z.object({
      start: z.string().optional(),
      end: z.string().optional(),
    }).optional().describe('Date range for the search'),
    user: z.string().optional().describe('Filter by specific user'),
    limit: z.number().optional().describe('Maximum number of messages to return'),
  }),
  outputSchema: summarySchema,
})
  .then(searchSlackMessages)
  .then(filterRelevantMessages)
  .then(generateSlackSummary);

slackWorkflow.commit();

export { slackWorkflow };