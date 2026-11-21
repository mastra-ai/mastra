import { INTERACTIVE_TOOL_SUSPENSION_KINDS } from '@mastra/core/tools';
import { describe, expect, it } from 'vitest';
import { classifyToolSuspension } from '../tool-suspension.js';

describe('interactive suspension compatibility', () => {
  it.each([
    ['ask_user', INTERACTIVE_TOOL_SUSPENSION_KINDS.askUser],
    ['submit_plan', INTERACTIVE_TOOL_SUSPENSION_KINDS.submitPlan],
    ['request_access', INTERACTIVE_TOOL_SUSPENSION_KINDS.requestAccess],
  ])('recognizes parked pre-upgrade %s payloads', (toolName, kind) => {
    expect(classifyToolSuspension({}, toolName)).toBe(kind);
    expect(classifyToolSuspension(undefined, toolName)).toBe(kind);
    expect(classifyToolSuspension({ kind }, 'renamed_tool')).toBe(kind);
    expect(classifyToolSuspension({ kind: 'plugin_interaction' }, toolName)).toBeUndefined();
    expect(classifyToolSuspension({ kind: null }, toolName)).toBeUndefined();
  });

  it.each([undefined, null, 'question', 42, {}, { kind: 'plugin_interaction' }])(
    'leaves unrelated suspensions alone: %j',
    payload => {
      expect(classifyToolSuspension(payload, 'plugin_tool')).toBeUndefined();
    },
  );
});
