type TraceSignalArtifact =
  | 'latestUserInput'
  | 'minifiedTrace'
  | 'summary'
  | 'tags'
  | 'entityIntent'
  | 'entityIntentSummary';

type TraceSignalDefinitionFixture = {
  id: string;
  name: string;
  displayLabel: string;
  description: string;
  taskPrompt: string;
  artifactAllowlist: TraceSignalArtifact[];
  version: number;
  status: 'active' | 'archived';
  enabled: boolean | null;
  createdAt: string;
  updatedAt: string;
};

type TraceSignalManagementListFixture = {
  definitions: TraceSignalDefinitionFixture[];
  limits: { maxDefinitionsPerOrganization: number };
};

type CreateTraceSignalDefinitionInputFixture = Pick<
  TraceSignalDefinitionFixture,
  'name' | 'displayLabel' | 'description' | 'taskPrompt' | 'artifactAllowlist'
>;

type UpdateTraceSignalDefinitionInputFixture = Omit<CreateTraceSignalDefinitionInputFixture, 'name'>;

type ProjectTraceSignalSettingFixture = {
  projectId: string;
  signalDefinitionId: string;
  enabled: boolean;
};

export const customSignalDefinitionFixture = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'handoff_quality',
  displayLabel: 'Handoff Quality',
  description: 'Whether the agent handed work off clearly.',
  taskPrompt: 'Describe the quality of any handoff in one sentence.',
  artifactAllowlist: ['latestUserInput', 'minifiedTrace'],
  version: 1,
  status: 'active',
  enabled: false,
  createdAt: '2026-08-18T12:00:00.000Z',
  updatedAt: '2026-08-18T12:00:00.000Z',
} satisfies TraceSignalDefinitionFixture;

export const archivedSignalDefinitionFixture = {
  ...customSignalDefinitionFixture,
  id: '22222222-2222-4222-8222-222222222222',
  name: 'resolution_detail',
  displayLabel: 'Resolution Detail',
  status: 'archived',
} satisfies TraceSignalDefinitionFixture;

export const signalManagementListFixture = {
  definitions: [customSignalDefinitionFixture, archivedSignalDefinitionFixture],
  limits: { maxDefinitionsPerOrganization: 7 },
} satisfies TraceSignalManagementListFixture;

export const createSignalDefinitionInputFixture = {
  name: 'tool_usage',
  displayLabel: 'Tool Usage',
  description: 'How the agent used tools.',
  taskPrompt: 'Describe how the agent used tools in one sentence.',
  artifactAllowlist: ['latestUserInput', 'minifiedTrace'],
} satisfies CreateTraceSignalDefinitionInputFixture;

export const updateSignalDefinitionInputFixture = {
  displayLabel: 'Handoff Clarity',
  description: customSignalDefinitionFixture.description,
  taskPrompt: customSignalDefinitionFixture.taskPrompt,
  artifactAllowlist: ['latestUserInput', 'minifiedTrace'],
} satisfies UpdateTraceSignalDefinitionInputFixture;

export const projectSignalSettingFixture = {
  projectId: 'project-1',
  signalDefinitionId: customSignalDefinitionFixture.id,
  enabled: true,
} satisfies ProjectTraceSignalSettingFixture;
