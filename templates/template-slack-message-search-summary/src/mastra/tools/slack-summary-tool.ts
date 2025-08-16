import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

interface SlackMessage {
  text: string;
  user: string;
  timestamp: string;
  channel: string;
  thread_ts?: string;
}

interface SlackConversation {
  messages: SlackMessage[];
  channel: string;
  timeframe: string;
  participants: string[];
}

export const slackSummaryTool = createTool({
  id: 'summarize-slack-messages',
  description: 'Generate an AI-powered summary of Slack messages and conversations',
  inputSchema: z.object({
    messages: z.array(z.object({
      text: z.string(),
      user: z.string(),
      timestamp: z.string(),
      channel: z.string(),
      thread_ts: z.string().optional(),
    })).describe('Array of Slack messages to summarize'),
    summaryType: z.enum(['brief', 'detailed', 'action-items', 'decisions']).optional().describe('Type of summary to generate'),
    focusArea: z.string().optional().describe('Specific area or topic to focus on in the summary'),
  }),
  outputSchema: z.object({
    summary: z.string(),
    keyPoints: z.array(z.string()),
    actionItems: z.array(z.string()),
    decisions: z.array(z.string()),
    participants: z.array(z.string()),
    timeframe: z.string(),
    messageCount: z.number(),
  }),
  execute: async ({ context, input }) => {
    const conversation: SlackConversation = {
      messages: input.messages,
      channel: input.messages[0]?.channel || 'unknown',
      timeframe: getTimeframe(input.messages),
      participants: getUniqueParticipants(input.messages),
    };

    return await generateSummary(conversation, input.summaryType || 'brief', input.focusArea);
  },
});

const generateSummary = async (
  conversation: SlackConversation,
  summaryType: 'brief' | 'detailed' | 'action-items' | 'decisions',
  focusArea?: string
) => {
  const { messages, channel, timeframe, participants } = conversation;

  // Sort messages chronologically
  const sortedMessages = messages.sort((a, b) => 
    parseFloat(a.timestamp) - parseFloat(b.timestamp)
  );

  // Extract key information based on summary type
  const summary = generateSummaryText(sortedMessages, summaryType, focusArea);
  const keyPoints = extractKeyPoints(sortedMessages);
  const actionItems = extractActionItems(sortedMessages);
  const decisions = extractDecisions(sortedMessages);

  return {
    summary,
    keyPoints,
    actionItems,
    decisions,
    participants,
    timeframe,
    messageCount: messages.length,
  };
};

const generateSummaryText = (
  messages: SlackMessage[],
  summaryType: string,
  focusArea?: string
): string => {
  if (messages.length === 0) {
    return "No messages to summarize.";
  }

  const messageTexts = messages.map(m => `${m.user}: ${m.text}`).join('\n');
  
  // This is a simplified implementation. In a real scenario, you might want to
  // use an LLM API call here for more sophisticated summarization
  const topics = extractTopics(messages);
  const mainTopic = topics[0] || 'general discussion';

  switch (summaryType) {
    case 'brief':
      return `Brief summary of ${messages.length} messages in ${messages[0]?.channel}: The conversation focused on ${mainTopic} with ${new Set(messages.map(m => m.user)).size} participants discussing key topics and making progress on various items.`;
    
    case 'detailed':
      return `Detailed conversation summary:\n\nThe discussion in ${messages[0]?.channel} involved ${new Set(messages.map(m => m.user)).size} participants over ${messages.length} messages. Main topics included: ${topics.slice(0, 3).join(', ')}. ${focusArea ? `Special focus on: ${focusArea}.` : ''}`;
    
    case 'action-items':
      return `Action items from the conversation: The team discussed various tasks and assignments. Key action items were identified and assigned to team members.`;
    
    case 'decisions':
      return `Decisions made during the conversation: The team reached several conclusions and made important decisions regarding project direction and implementation.`;
    
    default:
      return `Summary of ${messages.length} messages discussing ${mainTopic}.`;
  }
};

const extractKeyPoints = (messages: SlackMessage[]): string[] => {
  const keywordPatterns = [
    /important|crucial|critical|key|essential/i,
    /decision|decided|conclude|final/i,
    /action|todo|task|assign/i,
    /deadline|urgent|asap|priority/i,
  ];

  return messages
    .filter(m => keywordPatterns.some(pattern => pattern.test(m.text)))
    .map(m => `${m.user}: ${m.text.substring(0, 100)}...`)
    .slice(0, 5); // Limit to top 5 key points
};

const extractActionItems = (messages: SlackMessage[]): string[] => {
  const actionPatterns = [
    /todo|to do|action item|task|assign/i,
    /will do|i'll|let me|i can/i,
    /need to|should|must/i,
  ];

  return messages
    .filter(m => actionPatterns.some(pattern => pattern.test(m.text)))
    .map(m => `${m.user}: ${m.text}`)
    .slice(0, 5);
};

const extractDecisions = (messages: SlackMessage[]): string[] => {
  const decisionPatterns = [
    /decided|decision|conclude|final|agreed/i,
    /we will|let's go with|approved/i,
    /resolution|settled|confirmed/i,
  ];

  return messages
    .filter(m => decisionPatterns.some(pattern => pattern.test(m.text)))
    .map(m => `${m.user}: ${m.text}`)
    .slice(0, 5);
};

const extractTopics = (messages: SlackMessage[]): string[] => {
  // Simple topic extraction based on common words
  const allText = messages.map(m => m.text).join(' ').toLowerCase();
  const words = allText.split(/\s+/);
  
  // Count word frequency (excluding common words)
  const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'this', 'that', 'these', 'those']);
  
  const wordCount: Record<string, number> = {};
  words
    .filter(word => word.length > 3 && !commonWords.has(word))
    .forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

  return Object.entries(wordCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([word]) => word);
};

const getTimeframe = (messages: SlackMessage[]): string => {
  if (messages.length === 0) return 'unknown';
  
  const timestamps = messages.map(m => parseFloat(m.timestamp)).sort();
  const startTime = new Date(timestamps[0] * 1000);
  const endTime = new Date(timestamps[timestamps.length - 1] * 1000);
  
  const duration = endTime.getTime() - startTime.getTime();
  const hours = Math.floor(duration / (1000 * 60 * 60));
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

const getUniqueParticipants = (messages: SlackMessage[]): string[] => {
  return Array.from(new Set(messages.map(m => m.user)));
};