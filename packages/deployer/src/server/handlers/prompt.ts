import type { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import type { Context } from 'hono';
import { z } from 'zod';

import { handleError } from './error';

export async function generateSystemPromptHandler(c: Context) {
  try {
    // Check if this is a playground request
    const agentId = c.req.param('agentId');
    const isPlayground = c.get('playground') === true;
    if (!isPlayground) {
      return c.json({ error: 'This API is only available in the playground environment' }, 403);
    }

    const { instructions, comment } = await c.req.json();

    if (!instructions) {
      return c.json({ error: 'Missing instructions in request body' }, 400);
    }

    const mastra: Mastra<any> = c.get('mastra');
    const agent = mastra.getAgent(agentId);

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    let evalSummary = '';

    try {
      // Get both test and live evals
      const testEvals = (await mastra.getStorage()?.getEvalsByAgentName?.(agent.name, 'test')) || [];
      const liveEvals = (await mastra.getStorage()?.getEvalsByAgentName?.(agent.name, 'live')) || [];
      // Format eval results for the prompt
      const evalsMapped = [...testEvals, ...liveEvals].filter(
        ({ instructions: evalInstructions }) => evalInstructions === instructions,
      );

      evalSummary = evalsMapped
        .map(
          ({ input, output, result }) => `
          Input: ${input}\n
          Output: ${output}\n
          Result: ${JSON.stringify(result)}

        `,
        )
        .join('');
    } catch (error) {
      mastra.getLogger().error(`Error fetching evals`, { error });
    }

    const ENHANCE_SYSTEM_PROMPT_INSTRUCTIONS = `
            You are an expert system prompt engineer, specialized in analyzing and enhancing instructions to create clear, effective, and comprehensive system prompts. Your goal is to help users transform their basic instructions into well-structured system prompts that will guide AI behavior effectively.
            Follow these steps to analyze and enhance the instructions:
            1. ANALYSIS PHASE
            - Identify the core purpose and goals
            - Extract key constraints and requirements
            - Recognize domain-specific terminology and concepts
            - Note any implicit assumptions that should be made explicit
            2. PROMPT STRUCTURE
            Create a system prompt with these components:
            a) ROLE DEFINITION
                - Clear statement of the AI's role and purpose
                - Key responsibilities and scope
                - Primary stakeholders and users
            b) CORE CAPABILITIES
                - Main functions and abilities
                - Specific domain knowledge required
                - Tools and resources available
            c) BEHAVIORAL GUIDELINES
                - Communication style and tone
                - Decision-making framework
                - Error handling approach
                - Ethical considerations
            d) CONSTRAINTS & BOUNDARIES
                - Explicit limitations
                - Out-of-scope activities
                - Security and privacy considerations
            e) SUCCESS CRITERIA
                - Quality standards
                - Expected outcomes
                - Performance metrics
            3. QUALITY CHECKS
            Ensure the prompt is:
            - Clear and unambiguous
            - Comprehensive yet concise
            - Properly scoped
            - Technically accurate
            - Ethically sound
            4. OUTPUT FORMAT
            Return a structured response with:
            - Enhanced system prompt
            - Analysis of key components
            - Identified goals and constraints
            - Core domain concepts
            Remember: A good system prompt should be specific enough to guide behavior but flexible enough to handle edge cases. 
            Focus on creating prompts that are clear, actionable, and aligned with the intended use case.
        `;

    const systemPromptAgent = new Agent({
      name: 'system-prompt-enhancer',
      instructions: ENHANCE_SYSTEM_PROMPT_INSTRUCTIONS,
      model: agent.llm?.getModel(),
    });

    const result = await systemPromptAgent.generate(
      `
            We need to improve the system prompt. 
            Current: ${instructions}
            ${comment ? `User feedback: ${comment}` : ''}
            ${evalSummary ? `\nEvaluation Results:\n${evalSummary}` : ''}
        `,
      {
        output: z.object({
          new_prompt: z.string(),
          explanation: z.string(),
        }),
      },
    );

    return c.json(result?.object || {});
  } catch (error) {
    return handleError(error, 'Error generating system prompt');
  }
}
