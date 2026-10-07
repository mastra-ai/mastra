import type { GetMetricBreakdownResponse } from '@mastra/client-js';
import type { MetricsRequest } from '../msw-handlers';

export const emptyBreakdown: GetMetricBreakdownResponse = { groups: [] };

// Model usage: one breakdown per token metric, grouped by model.
const modelInputTokens: GetMetricBreakdownResponse = {
  groups: [
    { dimensions: { model: 'gpt-4o', provider: 'openai' }, value: 12000, estimatedCost: 0.3, costUnit: 'usd' },
    {
      dimensions: { model: 'claude-sonnet-4-5', provider: 'anthropic' },
      value: 4000,
      estimatedCost: 0.12,
      costUnit: 'usd',
    },
  ],
};
const modelOutputTokens: GetMetricBreakdownResponse = {
  groups: [
    { dimensions: { model: 'gpt-4o', provider: 'openai' }, value: 3000, estimatedCost: 0.2, costUnit: 'usd' },
    {
      dimensions: { model: 'claude-sonnet-4-5', provider: 'anthropic' },
      value: 1000,
      estimatedCost: 0.08,
      costUnit: 'usd',
    },
  ],
};

export const modelUsageBreakdown = ({ name }: MetricsRequest): GetMetricBreakdownResponse => {
  if (name[0] === 'mastra_model_total_input_tokens') return modelInputTokens;
  if (name[0] === 'mastra_model_total_output_tokens') return modelOutputTokens;
  return emptyBreakdown;
};

// Token usage by agent: input and output breakdowns grouped by entityName.
export const tokenUsageByAgentBreakdown = ({ name }: MetricsRequest): GetMetricBreakdownResponse => {
  if (name[0] === 'mastra_model_total_input_tokens') {
    return {
      groups: [
        { dimensions: { entityName: 'support-agent' }, value: 9000, estimatedCost: 0.2, costUnit: 'usd' },
        { dimensions: { entityName: 'triage-agent' }, value: 2000, estimatedCost: 0.05, costUnit: 'usd' },
      ],
    };
  }
  if (name[0] === 'mastra_model_total_output_tokens') {
    return {
      groups: [
        { dimensions: { entityName: 'support-agent' }, value: 1000, estimatedCost: 0.1, costUnit: 'usd' },
        { dimensions: { entityName: 'triage-agent' }, value: 500, estimatedCost: 0.02, costUnit: 'usd' },
      ],
    };
  }
  return emptyBreakdown;
};

// Memory: thread runs grouped by threadId/resourceId, thread counts grouped by resourceId.
export const memoryBreakdown = ({ name, groupBy }: MetricsRequest): GetMetricBreakdownResponse => {
  const byThread = groupBy[0] === 'threadId';
  if (name[0] === 'mastra_agent_duration_ms') {
    return byThread
      ? {
          groups: [
            { dimensions: { threadId: 'thread-aaaaaaaaaaaa-0001', resourceId: 'user-1' }, value: 12 },
            { dimensions: { threadId: 'thread-2', resourceId: null }, value: 3 },
          ],
        }
      : { groups: [{ dimensions: { resourceId: 'user-1' }, value: 4 }] };
  }
  return emptyBreakdown;
};

// Trace volume: one breakdown per entity type, grouped by entityName and status.
export const traceVolumeBreakdown = ({ name }: MetricsRequest): GetMetricBreakdownResponse => {
  if (name[0] === 'mastra_agent_duration_ms') {
    return {
      groups: [
        { dimensions: { entityName: 'support-agent', status: 'ok' }, value: 40 },
        { dimensions: { entityName: 'support-agent', status: 'error' }, value: 5 },
      ],
    };
  }
  if (name[0] === 'mastra_workflow_duration_ms') {
    return { groups: [{ dimensions: { entityName: 'onboarding', status: 'ok' }, value: 7 }] };
  }
  return emptyBreakdown;
};
