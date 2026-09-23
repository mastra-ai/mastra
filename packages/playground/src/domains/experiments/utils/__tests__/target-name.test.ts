import { describe, expect, it } from 'vitest';
import { EXTERNAL_TARGET_LABEL, resolveTargetName } from '../target-name';
import {
  agents,
  processors,
  scorers,
  workflows,
} from '@/domains/experiments/components/__tests__/fixtures/target-registries';

describe('resolveTargetName', () => {
  it('resolves agent, workflow, scorer and processor names from the registries', () => {
    expect(resolveTargetName({ targetType: 'agent', targetId: 'agent-1' }, { agents })).toBe('Support Agent');
    expect(resolveTargetName({ targetType: 'workflow', targetId: 'wf-1' }, { workflows })).toBe('Triage Workflow');
    expect(resolveTargetName({ targetType: 'scorer', targetId: 'sc-1' }, { scorers })).toBe('Relevancy');
    expect(resolveTargetName({ targetType: 'processor', targetId: 'proc-1' }, { processors })).toBe('PII Redactor');
  });

  it('falls back to the raw id when the target is unknown', () => {
    expect(resolveTargetName({ targetType: 'agent', targetId: 'ghost' }, { agents })).toBe('ghost');
    expect(resolveTargetName({ targetType: 'agent', targetId: 'agent-1' }, {})).toBe('agent-1');
    expect(resolveTargetName({ targetType: 'processor', targetId: 'proc-1' }, {})).toBe('proc-1');
  });

  it('labels caller-run experiments as external', () => {
    expect(resolveTargetName({ targetType: null, targetId: null }, {})).toBe(EXTERNAL_TARGET_LABEL);
  });
});
