import { describe, it, expect } from 'vitest';
import { resolvePickerVisibility } from './picker';

describe('resolvePickerVisibility', () => {
  const registeredToolIds = ['weather', 'search', 'calculator'] as const;
  const registeredAgentIds = ['triage', 'support', 'researcher'] as const;
  const registeredWorkflowIds = ['ticket-flow', 'onboarding'] as const;

  it('returns null (unrestricted) for all kinds when config is undefined', () => {
    const result = resolvePickerVisibility({
      config: undefined,
      registeredToolIds,
      registeredAgentIds,
      registeredWorkflowIds,
    });
    expect(result).toEqual({
      visibleTools: null,
      visibleAgents: null,
      visibleWorkflows: null,
      warnings: [],
    });
  });

  it('returns null per-kind when each allowlist is omitted', () => {
    const result = resolvePickerVisibility({
      config: {},
      registeredToolIds,
      registeredAgentIds,
      registeredWorkflowIds,
    });
    expect(result.visibleTools).toBeNull();
    expect(result.visibleAgents).toBeNull();
    expect(result.visibleWorkflows).toBeNull();
    expect(result.warnings).toEqual([]);
  });

  it('returns empty restricted lists when allowlists are []', () => {
    const result = resolvePickerVisibility({
      config: {
        tools: { allowed: [] },
        agents: { allowed: [] },
        workflows: { allowed: [] },
      },
      registeredToolIds,
      registeredAgentIds,
      registeredWorkflowIds,
    });
    expect(result).toEqual({
      visibleTools: [],
      visibleAgents: [],
      visibleWorkflows: [],
      warnings: [],
    });
  });

  it('filters to listed known IDs and preserves admin order per kind', () => {
    const result = resolvePickerVisibility({
      config: {
        tools: { allowed: ['search', 'weather'] },
        agents: { allowed: ['support', 'triage'] },
        workflows: { allowed: ['onboarding', 'ticket-flow'] },
      },
      registeredToolIds,
      registeredAgentIds,
      registeredWorkflowIds,
    });
    expect(result.visibleTools).toEqual(['search', 'weather']);
    expect(result.visibleAgents).toEqual(['support', 'triage']);
    expect(result.visibleWorkflows).toEqual(['onboarding', 'ticket-flow']);
    expect(result.warnings).toEqual([]);
  });

  it('drops unknown IDs and emits one warning per unknown across kinds', () => {
    const result = resolvePickerVisibility({
      config: {
        tools: { allowed: ['weather', 'ghost-tool'] },
        agents: { allowed: ['phantom-agent', 'support'] },
        workflows: { allowed: ['no-such-workflow'] },
      },
      registeredToolIds,
      registeredAgentIds,
      registeredWorkflowIds,
    });
    expect(result.visibleTools).toEqual(['weather']);
    expect(result.visibleAgents).toEqual(['support']);
    expect(result.visibleWorkflows).toEqual([]);
    expect(result.warnings).toHaveLength(3);
    expect(result.warnings.some(w => w.includes('"ghost-tool"') && w.includes('tool'))).toBe(true);
    expect(result.warnings.some(w => w.includes('"phantom-agent"') && w.includes('agent'))).toBe(true);
    expect(result.warnings.some(w => w.includes('"no-such-workflow"') && w.includes('workflow'))).toBe(true);
  });

  it('de-duplicates repeated IDs without double-warning per kind', () => {
    const result = resolvePickerVisibility({
      config: {
        tools: { allowed: ['weather', 'weather', 'ghost', 'ghost'] },
      },
      registeredToolIds,
      registeredAgentIds,
      registeredWorkflowIds,
    });
    expect(result.visibleTools).toEqual(['weather']);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('"ghost"');
  });

  it('treats kinds independently — restricted tools, null agents/workflows', () => {
    const result = resolvePickerVisibility({
      config: {
        tools: { allowed: ['weather'] },
      },
      registeredToolIds,
      registeredAgentIds,
      registeredWorkflowIds,
    });
    expect(result.visibleTools).toEqual(['weather']);
    expect(result.visibleAgents).toBeNull();
    expect(result.visibleWorkflows).toBeNull();
  });
});
