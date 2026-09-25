import { expect, it } from 'vitest';
import { resolveLinearWorkflowMapping } from '../../src/providers/linear-workflow-mapping.js';
import { readIntegrationConfig } from '../../src/env.js';
const states = [
  { id: 'backlog', name: 'Backlog', type: 'backlog', position: 0 },
  { id: 'started', name: 'In Progress', type: 'started', position: 1 },
  { id: 'done', name: 'Done', type: 'completed', position: 2 },
  { id: 'canceled', name: 'Canceled', type: 'canceled', position: 3 },
];
const base = { teamId: 'team', states, labels: [] };
it('discovers terminal states without any environment maps', () => {
  expect(resolveLinearWorkflowMapping(base)).toMatchObject({
    statusStateIds: {
      contained: 'done',
      closed: 'done',
      failed: 'started',
      awaiting_approval: 'started',
      rejected: 'canceled',
    },
    severityLabelIds: {},
  });
});
it('uses localized states by type and workflow order', () => {
  const localized = states.map(state => ({
    ...state,
    name: `Translated ${state.name}`,
  }));
  expect(
    resolveLinearWorkflowMapping({
      ...base,
      states: [...localized, { id: 'later', name: 'Released', type: 'completed', position: 9 }],
    }).statusStateIds.closed,
  ).toBe('done');
});
it('uses partial name overrides and scopes labels to the destination', () => {
  const mapping = resolveLinearWorkflowMapping({
    ...base,
    states: [...states, { id: 'review', name: 'Review', type: 'started', position: 2 }],
    labels: [
      { id: 'global', name: 'High' },
      { id: 'local', name: 'High', teamId: 'team' },
      { id: 'other', name: 'Critical', teamId: 'other' },
    ],
    statusStateNames: { awaiting_approval: ' review ' },
  });
  expect(mapping.statusStateIds.awaiting_approval).toBe('review');
  expect(mapping.statusStateIds.contained).toBe('done');
  expect(mapping.severityLabelIds).toEqual({ high: 'local' });
});
it('rejects explicit missing or duplicate names instead of guessing', () => {
  expect(() =>
    resolveLinearWorkflowMapping({
      ...base,
      statusStateNames: { contained: 'Missing' },
    }),
  ).toThrow('LINEAR_STATUS_STATE_NAMES_JSON.contained');
  expect(() =>
    resolveLinearWorkflowMapping({
      ...base,
      labels: [
        { id: 'a', name: 'High' },
        { id: 'b', name: 'High' },
      ],
      severityLabelNames: { high: 'High' },
    }),
  ).toThrow('LINEAR_SEVERITY_LABEL_NAMES_JSON.high');
});
it('preserves legacy IDs while allowing names to override them', () => {
  expect(
    resolveLinearWorkflowMapping({
      ...base,
      statusStateIds: { contained: 'legacy' },
    }).statusStateIds.contained,
  ).toBe('legacy');
  expect(
    resolveLinearWorkflowMapping({
      ...base,
      statusStateIds: { contained: 'legacy' },
      statusStateNames: { contained: 'Done' },
    }).statusStateIds.contained,
  ).toBe('done');
});
it('accepts partial name configuration and rejects unknown phases', () => {
  const env = {
    RUNTIME_MODE: 'staging',
    LINEAR_PROVIDER_ENABLED: 'true',
    LINEAR_API_KEY: 'test-linear-api-key',
    LINEAR_WORKSPACE_ID: 'workspace',
    LINEAR_TEAM_ID: 'team',
    LINEAR_INTERNAL_BASE_URL: 'https://security.example.test/dashboard',
    LINEAR_STATUS_STATE_NAMES_JSON: '{"contained":" Concluído "}',
    LINEAR_SEVERITY_LABEL_NAMES_JSON: '{"high":"Alta"}',
  };
  expect(readIntegrationConfig(env).linear).toMatchObject({
    statusStateNames: { contained: 'Concluído' },
    severityLabelNames: { high: 'Alta' },
  });
  expect(() =>
    readIntegrationConfig({
      ...env,
      LINEAR_STATUS_STATE_NAMES_JSON: '{"done":"Done"}',
    }),
  ).toThrow('LINEAR_STATUS_STATE_NAMES_JSON');
});
