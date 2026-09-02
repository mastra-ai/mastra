import type { GetAgentResponse, GetScorerResponse, GetWorkflowResponse } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';
import { EXTERNAL_TARGET_LABEL, resolveTargetName } from '../target-name';

const agents = { 'agent-1': { name: 'Support Agent' } as GetAgentResponse };
const workflows = { 'wf-1': { name: 'Triage Workflow' } as GetWorkflowResponse };
const scorers = { 'sc-1': { scorer: { config: { name: 'Relevancy' } } } as GetScorerResponse };

describe('resolveTargetName', () => {
  it('resolves agent, workflow and scorer names from the registries', () => {
    expect(resolveTargetName({ targetType: 'agent', targetId: 'agent-1' }, { agents })).toBe('Support Agent');
    expect(resolveTargetName({ targetType: 'workflow', targetId: 'wf-1' }, { workflows })).toBe('Triage Workflow');
    expect(resolveTargetName({ targetType: 'scorer', targetId: 'sc-1' }, { scorers })).toBe('Relevancy');
  });

  it('falls back to the raw id when the target is unknown', () => {
    expect(resolveTargetName({ targetType: 'agent', targetId: 'ghost' }, { agents })).toBe('ghost');
    expect(resolveTargetName({ targetType: 'agent', targetId: 'agent-1' }, {})).toBe('agent-1');
  });

  it('labels caller-run experiments as external', () => {
    expect(resolveTargetName({ targetType: null, targetId: null }, {})).toBe(EXTERNAL_TARGET_LABEL);
  });
});
