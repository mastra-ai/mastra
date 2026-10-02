import type { Agent } from '@mastra/core/agent';
import type { z } from 'zod';
import {
  ContainmentAnalysisCandidateSchema,
  SeverityAnalysisCandidateSchema,
  SummaryAnalysisCandidateSchema,
} from '../../triage/decision-contracts.js';
import type { ResponsePlannerInvoker } from '../../triage/prompt-safe-decision.js';
import { responsePlannerPrompt } from './response-planner.js';

/** Runtime binding lives outside the dataset's immutable prompt artifact. */
export function createResponsePlannerInvoker(agent: Agent): ResponsePlannerInvoker {
  return async (request, _attempt, signal) => {
    const schema: z.ZodType =
      request.task === 'severity'
        ? SeverityAnalysisCandidateSchema
        : request.task === 'summary'
          ? SummaryAnalysisCandidateSchema
          : ContainmentAnalysisCandidateSchema;
    return (
      await agent.generate(responsePlannerPrompt(request), {
        structuredOutput: { schema },
        toolChoice: 'none',
        maxSteps: 1,
        ...(signal ? { abortSignal: signal } : {}),
      })
    ).object;
  };
}
