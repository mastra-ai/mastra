import { Agent } from '@mastra/core/agent';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

/**
 * Agent Network Example - Supervisor Loop Pattern
 *
 * A supervisor agent sits inside the workflow loop and decides:
 * 1. Which specialist agent to delegate to next
 * 2. When the task is complete
 *
 * The workflow loops until the supervisor decides we're done.
 */

// ============================================
// Specialist Agents
// ============================================

const plannerAgent = new Agent({
  id: 'planner-agent',
  name: 'Research Planner',
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
  instructions: `
You are a critical reviewer. Review the work for accuracy, completeness, and clarity.
Point out specific issues that need improvement.
Be constructive and specific about what needs to change.
    `,
  model: 'openai/gpt-4.1',
});

// Agent registry
const agents: Record<string, Agent> = {
  planner: plannerAgent,
  researcher: researcherAgent,
  writer: writerAgent,
  critic: criticAgent,
};

// ============================================
// Supervisor Agent
// ============================================

const supervisorAgent = new Agent({
  id: 'supervisor-agent',
  name: 'Research Supervisor',
  instructions: `
You are a research project supervisor. You manage a team of specialists to complete research tasks.

## Your Team
- **planner**: Breaks down topics into research questions
- **researcher**: Answers specific research questions
- **writer**: Writes reports from research findings
- **critic**: Reviews work and suggests improvements

## Your Job
1. Analyze the current state of the work
2. Decide which specialist should work next
3. Provide clear instructions for that specialist
4. Determine when the task is complete

## Response Format (STRICT JSON)
You MUST respond with valid JSON in this exact format:
{
    "thinking": "Your analysis of current progress and what's needed next",
    "nextAgent": "planner" | "researcher" | "writer" | "critic" | "done",
    "taskForAgent": "Specific instructions for the next agent",
    "isComplete": true | false
}

## Guidelines
- Start with "planner" to break down the topic
- Use "researcher" to investigate each question
- Use "writer" to synthesize findings
- Use "critic" to review and improve
- Set "isComplete": true and "nextAgent": "done" when the final report is polished
- You may loop back (e.g., critic finds issues → writer revises)
- Aim for quality, but don't over-iterate (typically 4-8 steps total)
    `,
  model: 'openai/gpt-4.1',
});

// ============================================
// Workflow State Schema
// ============================================

const stateSchema = z.object({
  topic: z.string(),
  history: z.array(
    z.object({
      agent: z.string(),
      task: z.string(),
      result: z.string(),
    }),
  ),
  currentReport: z.string().optional(),
  isComplete: z.boolean(),
  iterations: z.number(),
});

// ============================================
// Workflow Steps
// ============================================

// Initialize step - sets up initial state
const initStep = createStep({
  id: 'init',
  inputSchema: z.object({
    topic: z.string(),
  }),
  outputSchema: stateSchema,
  execute: async ({ inputData }) => ({
    topic: inputData.topic,
    history: [],
    currentReport: undefined,
    isComplete: false,
    iterations: 0,
  }),
});

// Combined supervisor+worker step for the loop
const supervisorWorkerStep = createStep({
  id: 'supervisor-worker',
  inputSchema: stateSchema,
  outputSchema: stateSchema,
  execute: async ({ inputData }) => {
    // First: Supervisor decides what to do next
    const historyText =
      inputData.history.length > 0
        ? inputData.history
            .map((h, i) => `Step ${i + 1} - ${h.agent}:\nTask: ${h.task}\nResult: ${h.result.slice(0, 500)}...`)
            .join('\n\n---\n\n')
        : 'No work done yet.';

    const supervisorPrompt = `
Research Topic: ${inputData.topic}

Current Progress (${inputData.iterations} iterations):
${historyText}

${inputData.currentReport ? `Current Report Draft:\n${inputData.currentReport.slice(0, 1000)}...` : 'No report yet.'}

Decide the next step. Respond with JSON only.
        `;

    const supervisorResult = await supervisorAgent.generate(supervisorPrompt);

    let decision;
    try {
      const jsonMatch = supervisorResult.text.match(/\{[\s\S]*\}/);
      decision = JSON.parse(jsonMatch?.[0] || supervisorResult.text);
    } catch {
      decision = { nextAgent: 'done', taskForAgent: '', isComplete: true };
    }

    // Check if supervisor says we're done
    if (decision.isComplete || decision.nextAgent === 'done') {
      return {
        ...inputData,
        isComplete: true,
        iterations: inputData.iterations + 1,
      };
    }

    // Second: Execute the chosen specialist agent
    const agent = agents[decision.nextAgent];
    if (!agent) {
      return { ...inputData, isComplete: true, iterations: inputData.iterations + 1 };
    }

    const recentHistory = inputData.history
      .slice(-3)
      .map(h => `${h.agent}: ${h.result.slice(0, 300)}`)
      .join('\n\n');

    const workerPrompt = `
Topic: ${inputData.topic}

Recent work:
${recentHistory || 'Starting fresh.'}

${inputData.currentReport ? `Current draft:\n${inputData.currentReport}` : ''}

Your task: ${decision.taskForAgent}
        `;

    const workerResult = await agent.generate(workerPrompt);

    // Update report if writer produced output
    const newReport = decision.nextAgent === 'writer' ? workerResult.text : inputData.currentReport;

    return {
      topic: inputData.topic,
      history: [
        ...inputData.history,
        {
          agent: decision.nextAgent,
          task: decision.taskForAgent,
          result: workerResult.text,
        },
      ],
      currentReport: newReport,
      isComplete: false,
      iterations: inputData.iterations + 1,
    };
  },
});

// Finalize step - extracts final output
const finalizeStep = createStep({
  id: 'finalize',
  inputSchema: stateSchema,
  outputSchema: z.object({
    topic: z.string(),
    finalReport: z.string(),
    totalIterations: z.number(),
  }),
  execute: async ({ inputData }) => ({
    topic: inputData.topic,
    finalReport: inputData.currentReport || 'No report generated.',
    totalIterations: inputData.iterations,
  }),
});

// ============================================
// Supervisor Loop Workflow
// ============================================

export const supervisorLoopWorkflow = createWorkflow({
  id: 'supervisor-loop',
  steps: [initStep, supervisorWorkerStep, finalizeStep],
  inputSchema: z.object({
    topic: z.string().describe('The research topic'),
  }),
  outputSchema: z.object({
    topic: z.string(),
    finalReport: z.string(),
    totalIterations: z.number(),
  }),
});

// Build the workflow: init → loop(supervisor+worker until done) → finalize
supervisorLoopWorkflow
  .then(initStep)
  .dountil(supervisorWorkerStep, async ({ inputData, iterationCount }) => {
    // Stop when supervisor says complete OR after max iterations (safety limit)
    return inputData?.isComplete === true || iterationCount >= 10;
  })
  .then(finalizeStep)
  .commit();

// Export agents for use in Mastra
export { supervisorAgent, plannerAgent, researcherAgent, writerAgent, criticAgent };
