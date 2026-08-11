import { describe, expect, it } from 'vitest';

import {
  getEntryId,
  getEntryRetries,
  getEntrySchemas,
  getEntryWorkflow,
  runAgentEntry,
  runMappingEntry,
  runScorersForStep,
  runToolEntry,
} from './index';

// Non-default execution engines (e.g. @mastra/workflow-sdk) execute steps and
// declarative agent/tool/mapping entries host-side through these exports.
// Removing any of them silently breaks those engines, so pin the public surface.
describe('workflows public exports for alternate execution engines', () => {
  it('exposes the step scorer runner', () => {
    expect(runScorersForStep).toBeTypeOf('function');
  });

  it('exposes the declarative entry executors', () => {
    expect(runAgentEntry).toBeTypeOf('function');
    expect(runToolEntry).toBeTypeOf('function');
    expect(runMappingEntry).toBeTypeOf('function');
  });

  it('exposes the step-entry helpers', () => {
    expect(getEntryId).toBeTypeOf('function');
    expect(getEntryRetries).toBeTypeOf('function');
    expect(getEntrySchemas).toBeTypeOf('function');
    expect(getEntryWorkflow).toBeTypeOf('function');
  });
});
