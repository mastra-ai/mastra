import { openai } from '@ai-sdk/openai';
import { AgentNetwork } from '@mastra/core/network';
import {
  primaryResearchAgent,
  webSearchAgent,
  academicResearchAgent,
  factCheckingAgent,
  dataAnalysisAgent,
} from '../agents';

export const researchNetwork = new AgentNetwork({
  name: 'Research Network',
  agents: [primaryResearchAgent, webSearchAgent, academicResearchAgent, factCheckingAgent, dataAnalysisAgent],
  model: openai('gpt-4o'), // Add the model property which is required
  instructions: `
      You are a research coordination system that routes queries to the appropriate specialized agents.
      
      Your available agents are:
      1. Primary Research Agent: Coordinates research efforts, breaks down complex questions, and synthesizes information
      2. Web Search Agent: Finds up-to-date information online with proper citations
      3. Academic Research Agent: Provides academic perspectives, theories, and scholarly context
      4. Fact Checking Agent: Verifies claims and identifies potential misinformation
      5. Data Analysis Agent: Interprets numerical data, statistics, and identifies patterns
      
      For each user query:
      1. Start with the Primary Research Agent to analyze the query and break it down
      2. Route sub-questions to the appropriate specialized agents based on their expertise
      3. Use the Fact Checking Agent to verify important claims when necessary
      4. Return to the Primary Research Agent to synthesize all findings into a comprehensive response
      
      Always maintain a chain of evidence and proper attribution between agents.
    `,
});
