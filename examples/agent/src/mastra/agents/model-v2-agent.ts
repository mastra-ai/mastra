import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai-v5';
import { lessComplexWorkflow, myWorkflow } from '../workflows';
import { Memory } from '@mastra/memory';
import { ModerationProcessor } from '@mastra/core/processors';
import { logDataMiddleware } from '../../model-middleware';
import { wrapLanguageModel } from 'ai-v5';
import { cookingTool } from '../tools';
import {
  advancedModerationWorkflow,
  branchingModerationWorkflow,
  contentModerationWorkflow,
} from '../workflows/content-moderation';
import { stepLoggerProcessor, responseQualityProcessor } from '../processors';
import { findUserWorkflow } from '../workflows/other';
import { createScorer } from '@mastra/core/evals';
import { weatherTool as weatherInfo } from '../tools/weather-tool';

import { Workspace, LocalFilesystem } from '@mastra/core/workspace';

const workspace = new Workspace({
  filesystem: new LocalFilesystem({
    basePath: './workspace',
  }),
});

const memory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
    },
  },
});

// const testAPICallError = new APICallError({
//   message: 'Test API error',
//   url: 'https://test.api.com',
//   requestBodyValues: { test: 'test' },
//   statusCode: 401,
//   isRetryable: false,
//   responseBody: 'Test API error response',
// });

export const errorAgent = new Agent({
  id: 'error-agent',
  name: 'Error Agent',
  instructions: 'You are an error agent that always errors',
  model: 'openai/gpt-4o-mini',
});

export const moderationProcessor = new ModerationProcessor({
  model: openai('gpt-4.1-nano'),
  categories: ['hate', 'harassment', 'violence'],
  threshold: 0.7,
  strategy: 'block',
  instructions: 'Detect and flag inappropriate content in user messages',
});

export const chefModelV2Agent = new Agent({
  workspace,
  id: 'chef-model-v2-agent',
  name: 'Chef Agent V2 Model',
  description: 'A chef agent that can help you cook great meals with whatever ingredients you have available.',
  instructions: {
    content: `
      You are Michel, a practical and experienced home chef who helps people cook great meals with whatever
      ingredients they have available. Your first priority is understanding what ingredients and equipment the user has access to, then suggesting achievable recipes.
      You explain cooking steps clearly and offer substitutions when needed, maintaining a friendly and encouraging tone throughout.
      `,
    role: 'system',
  },
  model: wrapLanguageModel({
    model: openai('gpt-4o-mini'),
    middleware: logDataMiddleware,
  }),
  tools: {
    weatherInfo,
    cookingTool,
  },
  workflows: {
    myWorkflow,
    lessComplexWorkflow,
    findUserWorkflow,
  },
  scorers: ({ mastra }) => {
    if (!mastra) {
      throw new Error('Mastra not found');
    }
    const scorer1 = mastra.getScorerById('scorer1');

    return {
      scorer1: { scorer: scorer1, sampling: { rate: 1, type: 'ratio' } },
    };
  },
  memory,
  inputProcessors: [moderationProcessor],
  defaultOptions: {
    autoResumeSuspendedTools: true,
  },
});

const weatherAgent = new Agent({
  id: 'weather-agent',
  name: 'Weather Agent',
  instructions: `Your goal is to execute the recipe-maker workflow with the given ingredient`,
  description: `An agent that can help you get a recipe for a given ingredient`,
  model: 'openai/gpt-4o-mini',
  tools: {
    weatherInfo,
  },
  workflows: {
    myWorkflow,
  },
});

let count = 1;

export const networkAgent = new Agent({
  id: 'network-agent',
  name: 'Chef Network',
  description:
    'A chef agent that can help you cook great meals with whatever ingredients you have available based on your location and current weather.',
  instructions: `You are a the manager of several agent, tools, and workflows. Use the best primitives based on what the user wants to accomplish your task.`,
  model: 'openai/gpt-4o-mini',
  agents: {
    weatherAgent,
  },
  workflows: {
    myWorkflow,
    findUserWorkflow,
  },
  // tools: {
  //   weatherInfo,
  // },
  memory,
  defaultNetworkOptions: {
    autoResumeSuspendedTools: true,
    completion: {
      scorers: [
        createScorer({
          id: 'scorer12',
          name: 'My Scorer 2',
          description: 'Scorer 2',
        }).generateScore(() => {
          return 1;
        }),
        createScorer({
          id: 'scorer15',
          name: 'My Scorer 5',
          description: 'Scorer 5',
        }).generateScore(() => {
          count++;
          return count > 2 ? 1 : 0.7;
        }),
      ],
      strategy: 'all',
    },
  },
});

// =============================================================================
// Agents with Processor Workflows
// These demonstrate using processor workflows for content moderation
// =============================================================================

/**
 * Agent with Advanced Moderation Workflow
 *
 * Uses the advanced moderation workflow that includes:
 * - Length validation
 * - Parallel PII, toxicity, and spam checks
 * - Language detection
 */
export const agentWithAdvancedModeration = new Agent({
  id: 'agent-with-advanced-moderation',
  name: 'Agent with Advanced Moderation',
  description: 'A helpful assistant with advanced content moderation using parallel processor checks.',
  instructions: `You are a helpful assistant. Always provide detailed, thoughtful responses.`,
  model: 'openai/gpt-4o-mini',
  inputProcessors: [advancedModerationWorkflow],
  outputProcessors: [responseQualityProcessor, stepLoggerProcessor],
  maxProcessorRetries: 2,
});

/**
 * Agent with Branching Moderation Workflow
 *
 * Uses conditional branching to apply different processors based on content.
 */
export const agentWithBranchingModeration = new Agent({
  id: 'agent-with-branching-moderation',
  name: 'Agent with Branching Moderation',
  description: 'A helpful assistant with smart content moderation that branches based on message content.',
  instructions: `You are a helpful assistant.`,
  model: 'openai/gpt-4o-mini',
  inputProcessors: [branchingModerationWorkflow],
  outputProcessors: [stepLoggerProcessor],
  maxProcessorRetries: 2,
});

/**
 * Agent with Sequential Moderation Workflow
 *
 * Uses a simple sequential workflow for content moderation.
 */
export const agentWithSequentialModeration = new Agent({
  id: 'agent-with-sequential-moderation',
  name: 'Agent with Sequential Moderation',
  description: 'A helpful assistant with sequential content moderation checks.',
  instructions: `You are a helpful assistant.`,
  model: 'openai/gpt-4o-mini',
  inputProcessors: [contentModerationWorkflow],
  outputProcessors: [responseQualityProcessor],
  maxProcessorRetries: 2,
});

// =============================================================================
// Supervisor Pattern Example
// Demonstrates completion scoring, iteration hooks, delegation hooks, and context filtering
// =============================================================================

/**
 * Research Sub-Agent
 *
 * Specialized agent that performs research tasks
 */
export const researchAgent = new Agent({
  id: 'research-agent',
  name: 'Research Agent',
  description: 'Performs detailed research on given topics',
  instructions: `You are a research specialist. When given a topic, provide comprehensive research findings with:
    - Key facts and statistics
    - Multiple perspectives
    - Relevant sources
    Be thorough but concise.`,
  model: 'openai/gpt-4o-mini',
  tools: {
    weatherInfo, // Example tool for demonstration
  },
});

/**
 * Alternative Research Sub-Agent
 *
 * Another research agent that should NOT be used (for demonstration purposes)
 */
export const alternativeResearchAgent = new Agent({
  id: 'alternative-research-agent',
  name: 'Alternative Research Agent',
  description: 'Alternative research agent (deprecated - use research-agent instead)',
  instructions: `You are a secondary research specialist. Note: This agent is deprecated in favor of the primary research-agent.`,
  model: 'openai/gpt-4o-mini',
  tools: {
    weatherInfo,
  },
});

/**
 * Analysis Sub-Agent
 *
 * Specialized agent that analyzes information
 */
export const analysisAgent = new Agent({
  id: 'analysis-agent',
  name: 'Analysis Agent',
  description: 'Analyzes data and provides insights',
  instructions: `You are an analysis expert. When given information, provide:
    - Critical analysis
    - Key insights
    - Actionable recommendations
    Focus on quality over quantity.`,
  model: 'openai/gpt-4o-mini',
});

/**
 * Supervisor Agent with Full Feature Demo
 *
 * This agent demonstrates all supervisor pattern features:
 * 1. Completion Scoring - Validates task completion with custom scorers
 * 2. Iteration Hooks - Monitors progress after each iteration
 * 3. Delegation Hooks - Controls subagent execution
 * 4. Context Filtering - Limits context passed to subagents
 */

export const supervisorAgent = new Agent({
  id: 'supervisor-agent',
  name: 'Research Supervisor',
  description: 'Coordinates research and analysis tasks with intelligent delegation and monitoring',
  instructions: `You are a research supervisor that coordinates complex research tasks.

    Your workflow:
    1. Break down the user's request into research and analysis tasks
    2. Delegate to the research-agent for gathering information
    3. Delegate to the analysis-agent for analyzing findings
    4. Synthesize results into a comprehensive response

    Use the subagents effectively and iterate until the task is complete.`,
  model: 'openai/gpt-4o-mini',
  agents: {
    researchAgent,
    alternativeResearchAgent,
    analysisAgent,
  },
  memory,
  defaultOptions: {
    maxSteps: 10,

    // IsTaskComplete Scoring - Automatically validates task completion
    isTaskComplete: {
      scorers: [
        // Scorer 1: Check if research covers all key aspects
        createScorer({
          id: 'research-completeness',
          name: 'Research Completeness',
          description: 'Checks if research covers all key aspects',
        })
          .generateScore(async context => {
            const text = (context.run.output || '').toString()?.toLowerCase();
            console.dir({ 'research-completeness-Scorer': text }, { depth: null });
            const hasResearch = text.includes('research') || text.includes('findings');
            const hasAnalysis = text.includes('analysis') || text.includes('insight');
            const hasRecommendations = text.includes('recommendation');
            return (hasResearch && hasAnalysis) || hasRecommendations ? 1 : 0.5;
          })
          .generateReason(async context => {
            const text = (context.run.output || '').toString()?.toLowerCase();
            const hasResearch = text.includes('research') || text.includes('findings');
            const hasAnalysis = text.includes('analysis') || text.includes('insight');
            const hasRecommendations = text.includes('recommendation');
            return (hasResearch && hasAnalysis) || hasRecommendations
              ? 'Research is complete'
              : 'Research is not complete, please provide more details, ensure words like research/findings analysis/insight are added and add recommendations based on the research analysis';
          }),

        // Scorer 2: Validate response has sufficient detail
        createScorer({
          id: 'response-quality',
          name: 'Response Quality',
          description: 'Validates response has sufficient detail',
        })
          .generateScore(async context => {
            const text = (context.run.output || '').toString();
            console.dir({ 'response-quality-Scorer': text }, { depth: null });
            const wordCount = text.split(/\s+/).length;
            return wordCount >= 200 ? 1 : wordCount / 200;
          })
          .generateReason(async context => {
            const text = (context.run.output || '').toString();
            const wordCount = text.split(/\s+/).length;
            return wordCount >= 200
              ? 'Response is sufficient'
              : 'Response is not sufficient, please provide more details, at least 200 words';
          }),
      ],
      strategy: 'all', // All scorers must pass
      onComplete: async result => {
        console.log('✨ Completion check:', result.complete ? 'PASSED ✅' : 'FAILED ❌');
        console.log('📊 Scores:', result.scorers.map(s => `${s.scorerName}: ${s.score.toFixed(2)}`).join(', '));
      },
    },

    //Iteration Hooks - Monitor progress after each iteration
    onIterationComplete: async context => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔄 Iteration ${context.iteration}${context.maxIterations ? `/${context.maxIterations}` : ''}`);
      console.log(`📊 Status: ${context.isFinal ? 'FINAL ✅' : 'CONTINUING ⏳'}`);
      console.log(`🏁 Finish Reason: ${context.finishReason}`);
      console.log(`🔧 Tool Calls: ${context.toolCalls.map(tc => tc.name).join(', ') || 'None'}`);
      console.log(`📝 Response Length: ${context.text.length} chars`);
      console.log(`${'='.repeat(60)}\n`);

      // Provide feedback to guide the agent
      if (context.iteration === 3 && !context.text.includes('recommendation')) {
        return {
          continue: true,
          feedback: 'Good progress! Please include specific recommendations in your response.',
        };
      }

      // Stop early if we have a comprehensive response
      if (context.text.length > 500 && context.text.includes('recommendation')) {
        console.log('✅ Response is comprehensive, stopping early');
        return { continue: false };
      }

      return { continue: true };
    },

    // Delegation Hooks - Control subagent execution
    delegation: {
      // Called before delegating to a subagent
      onDelegationStart: async context => {
        console.log(`\n${'━'.repeat(60)}`);
        console.log(`🚀 DELEGATING TO: ${context.primitiveId.toUpperCase()}`);
        console.log(`📋 Prompt: ${context.prompt.substring(0, 100)}${context.prompt.length > 100 ? '...' : ''}`);
        console.log(`🔢 Iteration: ${context.iteration}`);
        console.log(`${'━'.repeat(60)}\n`);

        // Reject delegation to alternative research agent
        if (context.primitiveId === 'alternative-research-agent') {
          console.log('❌ Rejecting delegation to alternative-research-agent');
          return {
            proceed: false,
            rejectionReason:
              'The alternative-research-agent is deprecated. Please use the research-agent instead for all research tasks.',
          };
        }

        // Add temporal context for research tasks
        if (context.primitiveId === 'research-agent') {
          return {
            proceed: true,
            modifiedPrompt: `${context.prompt}\n\n⚠️ IMPORTANT: Focus on recent developments and data from 2024-2025.`,
            modifiedMaxSteps: 5,
          };
        }

        // Limit delegations in later iterations
        if (context.iteration > 8) {
          console.log('⚠️ Maximum iteration depth reached, rejecting delegation');
          return {
            proceed: false,
            rejectionReason: 'Maximum delegations reached. Please synthesize existing findings into a final response.',
          };
        }

        return { proceed: true };
      },

      // Called after subagent completes
      onDelegationComplete: async context => {
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`✅ COMPLETED: ${context.primitiveId.toUpperCase()}`);
        console.log(`📊 Result Size: ${JSON.stringify(context.result).length} chars`);
        console.log(`${'─'.repeat(60)}\n`);

        // Bail out on critical errors
        if (context.error) {
          console.log('⚠️ Sub-agent returned an error, bailing out');
          context.bail();
          return;
        }
      },

      // Context Filtering - Control what context is passed to subagents.
      // Receives the full parent message history and delegation metadata.
      // Returns the messages to forward to the subagent.
      messageFilter: ({ messages, primitiveId, iteration }) => {
        console.log(
          `🔍 messageFilter: preparing context for ${primitiveId} (iteration ${iteration}). messages: ${messages.length}`,
        );

        return (
          messages
            // Don't forward system messages to subagents
            .filter(m => m.role !== 'system')
            // Strip messages containing sensitive data
            .filter(message => {
              const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
              const hasSensitiveData =
                content.toLowerCase().includes('confidential') ||
                content.toLowerCase().includes('secret') ||
                content.toLowerCase().includes('api_key');
              return !hasSensitiveData;
            })
            // Analysis agent only needs the last 5 messages — it works on the output of research,
            // so deep history isn't useful. Research agent gets up to 10.
            .slice(primitiveId === 'analysis-agent' ? -5 : -10)
        );
      },
    },
  },
});
