import { describe, expect, it } from '@jest/globals';

import { Framework } from '../src';
import { CORE_INTEGRATION_NAME } from '../src/constants';
import { IntegrationApi, IntegrationEvent } from '../src/types';
import { createMockAction, createMockEvent, MockIntegration } from './utils';

const testFrameworkName = 'TEST_FRAMEWORK';
const testIntegrationName = 'TEST_INTEGRATION';
const testActionType = 'TEST_ACTION';
const testEventKey = 'TEST_EVENT';
const testIntegrationActionType = 'TEST_INTEGRATION_ACTION';
const testIntegrationEventKey = 'TEST_INTEGRATION_EVENT';

const mockSystemActions: IntegrationApi[] = [
  createMockAction({
    type: testActionType,
    integrationName: CORE_INTEGRATION_NAME,
  }),
];

const mockIntegrationAction: IntegrationApi = createMockAction({
  type: testIntegrationActionType,
  integrationName: testIntegrationName,
});

const mockIntegrationEvent: Record<
  string,
  IntegrationEvent<MockIntegration>
> = createMockEvent({
  key: testIntegrationEventKey,
});

const mockSystemEvents: Record<
  string,
  IntegrationEvent<MockIntegration>
> = createMockEvent({ key: testEventKey });

const integrationFramework = Framework.init({
  name: testFrameworkName,
  integrations: [
    new MockIntegration({
      name: testIntegrationName,
      logoUrl: 'test',
      events: mockIntegrationEvent,
      apis: { [testIntegrationActionType]: mockIntegrationAction },
    }),
  ],
  systemApis: mockSystemActions,
  systemEvents: mockSystemEvents,
  db: {
    provider: 'postgres',
    uri: 'test',
  },
  systemHostURL: `http://localhost:3000`,
  routeRegistrationPath: '/api/kepler',
  blueprintDirPath: '',
});

describe('Integration Framework', () => {
  it('Should create a framework', () => {
    expect(integrationFramework).toBeDefined();
  });

  it('Should register system actions', () => {
    expect(Object.values(integrationFramework.getSystemApis() ?? {})).toEqual(
      mockSystemActions
    );
  });

  it('Should register system events', () => {
    expect(integrationFramework.getSystemEvents()).toEqual(mockSystemEvents);
  });

  describe('integration', () => {
    it('Should register am integration', () => {
      const available = integrationFramework.availableIntegrations();
      expect(available.length).toBe(1);
      expect(available[0].name).toBe(testIntegrationName);
    });

    it('Should get integration by name', () => {
      const plugin = integrationFramework.getIntegration(testIntegrationName);
      expect(plugin).toBeDefined();
    });

    it('Should register integration actions', () => {
      const actions =
        integrationFramework.getApisByIntegration(testIntegrationName);
      expect(actions).toBeDefined();
      expect(JSON.stringify(Object.values(actions ?? {}))).toContain(
        JSON.stringify(mockIntegrationAction)
      );
    });

    it('Should register integration events', () => {
      const events =
        integrationFramework.getEventsByIntegration(testIntegrationName);

      expect(events).toBeDefined();
      expect(events).toEqual(mockIntegrationEvent);
    });
  });
});
