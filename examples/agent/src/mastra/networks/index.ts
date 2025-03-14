import { AgentNetwork } from '@mastra/core/network';
import {
  analysisAgent,
  searchAgent,
  synthesisAgent,
  gapAnalysisAgent,
  counterArgumentAgent,
  evidenceCollectorAgent,
} from '../agents';
import { openai } from '@ai-sdk/openai';

// Deep Research Network
export const researchNetwork = new AgentNetwork({
  name: 'Deep Research Network',
  agents: [
    searchAgent, // Research planning and strategy
    evidenceCollectorAgent, // Gathering and organizing evidence
    analysisAgent, // Critical evaluation of sources
    counterArgumentAgent, // Alternative perspectives
    gapAnalysisAgent, // Identifying knowledge gaps
    synthesisAgent, // Final integration and framework building
  ],
  routingModel: openai('gpt-4o'),
  instructions: `
    A comprehensive research network that performs deep, rigorous investigation of topics. 
    This network follows a systematic research process:
    1. Strategic planning and question formulation
    2. Evidence collection from authoritative sources
    3. Critical evaluation of information quality
    4. Consideration of alternative perspectives
    5. Identification of knowledge gaps
    6. Integration into a coherent knowledge framework
    
    The network produces structured research outputs with clear findings, supporting evidence, and limitations.
    `,
});
