import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

/**
 * Agent Network Example - Using Mastra's Built-in agent.network()
 *
 * This uses Mastra's native multi-agent orchestration where a routing agent
 * automatically delegates to sub-agents and loops until the task is complete.
 *
 * Usage:
 *   const result = await researchNetworkAgent.network('Research AI in healthcare', { maxSteps: 10 });
 *   for await (const chunk of result.stream) { console.log(chunk); }
 */

const memory = new Memory();

// ============================================
// Specialist Agents
// ============================================

const plannerAgent = new Agent({
  id: 'planner-agent',
  name: 'Research Planner',
  description: 'Breaks down research topics into specific, answerable questions. Use this first to plan the research.',
  instructions: `
You are a research planning specialist. Given a research topic, break it down into 3-5 specific research questions.

Output a numbered list of focused, answerable questions.
Be specific and actionable. No meta-commentary.
    `,
  model: 'openai/gpt-4.1',
});

const researcherAgent = new Agent({
  id: 'researcher-agent',
  name: 'Researcher',
  description:
    'Investigates specific research questions and provides comprehensive answers. Use this after planning to gather information.',
  instructions: `
You are a thorough researcher. Given a research question, provide a comprehensive answer.
Include key facts, examples, and important nuances.
Be factual and specific. 2-3 paragraphs.
    `,
  model: 'openai/gpt-4.1',
});

const writerAgent = new Agent({
  id: 'writer-agent',
  name: 'Writer',
  description:
    'Synthesizes research findings into clear, well-structured reports. Use this after research is complete.',
  instructions: `
You are an expert writer. Given research findings, write a clear, well-structured report.
Include an executive summary, organized sections, and conclusions.
Professional but accessible style.
    `,
  model: 'openai/gpt-4.1',
});

const criticAgent = new Agent({
  id: 'critic-agent',
  name: 'Critic',
  description: 'Reviews work for accuracy, completeness, and clarity. Use this to validate and improve the report.',
  instructions: `
You are a critical reviewer. Review the work for accuracy, completeness, and clarity.
Point out specific issues that need improvement.
Be constructive and specific about what needs to change.
    `,
  model: 'openai/gpt-4.1',
});

// ============================================
// Research Network Agent (Routing Agent)
// ============================================

export const researchNetworkAgent = new Agent({
  id: 'research-network-agent',
  name: 'Research Network',
  description: 'A multi-agent research network that coordinates specialists to complete research tasks.',
  instructions: `
You are the coordinator of a research network. Your job is to delegate tasks to specialist agents and synthesize their work into a complete research report.

## Your Team
- **plannerAgent**: Breaks down topics into research questions. Use this FIRST.
- **researcherAgent**: Investigates specific questions. Use this after planning, once per question.
- **writerAgent**: Creates reports from findings. Use this after research is gathered.
- **criticAgent**: Reviews and improves work. Use this to validate the final report.

## Workflow
1. Start with plannerAgent to break down the topic
2. Use researcherAgent for each question (may need multiple calls)
3. Use writerAgent to synthesize findings into a report
4. Use criticAgent to review the report
5. If critic finds issues, use writerAgent to revise
6. Mark complete when the report is polished

## Important
- Provide clear, specific instructions to each agent
- Build on previous work - reference what other agents have produced
- Aim for quality over speed (typically 5-8 agent calls)
    `,
  model: 'openai/gpt-4.1',
  memory,
  agents: {
    plannerAgent,
    researcherAgent,
    writerAgent,
    criticAgent,
  },
});
