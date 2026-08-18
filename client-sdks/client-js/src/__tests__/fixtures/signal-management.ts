import type {
  CreateTraceSignalDefinitionInput,
  ProjectTraceSignalSetting,
  TraceSignalDefinition,
  TraceSignalManagementListResponse,
  UpdateTraceSignalDefinitionInput,
} from '../../agent-learning';

export const customSignalDefinitionFixture: TraceSignalDefinition = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'handoff_quality',
  displayLabel: 'Handoff Quality',
  description: 'Whether the agent handed work off clearly.',
  taskPrompt: 'Describe the quality of any handoff in one sentence.',
  extraOutputRules: [],
  artifactAllowlist: ['latestUserInput', 'minifiedTrace'],
  version: 1,
  status: 'active',
  enabled: false,
  createdAt: '2026-08-18T12:00:00.000Z',
  updatedAt: '2026-08-18T12:00:00.000Z',
};

export const archivedSignalDefinitionFixture: TraceSignalDefinition = {
  ...customSignalDefinitionFixture,
  id: '22222222-2222-4222-8222-222222222222',
  name: 'resolution_detail',
  displayLabel: 'Resolution Detail',
  status: 'archived',
};

export const signalManagementListFixture: TraceSignalManagementListResponse = {
  definitions: [customSignalDefinitionFixture, archivedSignalDefinitionFixture],
  limits: { maxDefinitionsPerOrganization: 7 },
};

export const createSignalDefinitionInputFixture: CreateTraceSignalDefinitionInput = {
  name: 'tool_usage',
  displayLabel: 'Tool Usage',
  description: 'How the agent used tools.',
  taskPrompt: 'Describe how the agent used tools in one sentence.',
  extraOutputRules: [],
  artifactAllowlist: ['latestUserInput', 'minifiedTrace'],
};

export const updateSignalDefinitionInputFixture: UpdateTraceSignalDefinitionInput = {
  displayLabel: 'Handoff Clarity',
  description: customSignalDefinitionFixture.description,
  taskPrompt: customSignalDefinitionFixture.taskPrompt,
  extraOutputRules: [],
  artifactAllowlist: ['latestUserInput', 'minifiedTrace'],
};

export const projectSignalSettingFixture: ProjectTraceSignalSetting = {
  projectId: 'project-1',
  signalDefinitionId: customSignalDefinitionFixture.id,
  enabled: true,
};
