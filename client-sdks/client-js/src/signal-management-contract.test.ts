import { describe, expect, it } from 'vitest';
import {
  createSignalDefinitionInputFixture,
  customSignalDefinitionFixture,
  projectSignalSettingFixture,
  signalManagementListFixture,
  updateSignalDefinitionInputFixture,
} from './__tests__/fixtures/signal-management';

describe('trace signal management contracts', () => {
  it('enumerates the complete definition and organization limit response', () => {
    expect(Object.keys(customSignalDefinitionFixture)).toEqual([
      'id',
      'name',
      'displayLabel',
      'description',
      'taskPrompt',
      'version',
      'status',
      'enabled',
      'createdAt',
      'updatedAt',
    ]);
    expect(signalManagementListFixture.limits.maxDefinitionsPerOrganization).toBe(7);
  });

  it('keeps create, update, and project enablement shapes explicit', () => {
    expect(createSignalDefinitionInputFixture.name).toBe('tool_usage');
    expect(updateSignalDefinitionInputFixture).not.toHaveProperty('name');
    expect(projectSignalSettingFixture).toEqual({
      projectId: 'project-1',
      signalDefinitionId: customSignalDefinitionFixture.id,
      enabled: true,
    });
  });
});
