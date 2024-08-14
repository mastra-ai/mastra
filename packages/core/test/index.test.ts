import { describe, expect, it } from '@jest/globals';

import { CORE_PLUGIN_NAME, createFramework } from '../src';

import { IntegrationAction, IntegrationEvent } from '../src/types';
import { createMockAction, createMockEvent, MockPlugin } from './utils';

const testFrameworkName = 'TEST_FRAMEWORK';
const testPluginName = 'TEST_PLUGIN';
const testActionType = 'TEST_ACTION';
const testEventKey = 'TEST_EVENT';
const testPluginActionType = 'TEST_PLUGIN_ACTION';
const testPluginEventKey = 'TEST_PLUGIN_EVENT';

const mockSystemActions: IntegrationAction[] = [
  createMockAction({ type: testActionType, pluginName: CORE_PLUGIN_NAME }),
];

const mockPluginAction: IntegrationAction = createMockAction({
  type: testPluginActionType,
  pluginName: testPluginName,
});

const mockPluginEvent: IntegrationEvent = createMockEvent({
  key: testPluginEventKey,
});

const mockSystemEvents: IntegrationEvent[] = [
  createMockEvent({ key: testEventKey }),
];

const integrationFramework = createFramework({
  name: testFrameworkName,
  plugins: [
    new MockPlugin({
      name: testPluginName,
      logoUrl: 'test',
      events: { [testPluginEventKey]: mockPluginEvent },
      actions: { [testPluginActionType]: mockPluginAction },
    }),
  ],
  systemActions: mockSystemActions,
  systemEvents: mockSystemEvents,
  db: {
    provider: 'postgres',
    uri: 'test',
  },
});

describe('Integration Framework', () => {
  it('Should create a framework', () => {
    expect(integrationFramework).toBeDefined();
  });

  it('Should register system actions', () => {
    expect(
      Object.values(integrationFramework.getSystemActions() ?? {})
    ).toEqual(mockSystemActions);
  });

  it('Should register system events', () => {
    expect(Object.values(integrationFramework.getSystemEvents() ?? {})).toEqual(
      mockSystemEvents
    );
    ``;
  });

  describe('plugin', () => {
    it('Should register a plugin', () => {
      const available = integrationFramework.availablePlugins();
      expect(available.length).toBe(1);
      expect(available[0].name).toBe(testPluginName);
    });

    it('Should get plugin by name', () => {
      const plugin = integrationFramework.getPlugin(testPluginName);
      expect(plugin).toBeDefined();
    });

    it('Should register plugin actions', () => {
      const actions = integrationFramework.getActionsByPlugin(testPluginName);
      expect(actions).toBeDefined();
      expect(JSON.stringify(Object.values(actions ?? {}))).toEqual(
        JSON.stringify([mockPluginAction])
      );
    });

    it('Should register plugin events', () => {
      const events = integrationFramework.getEventsByPlugin(testPluginName);
      expect(events).toBeDefined();
      expect(Object.values(events ?? {})).toEqual([mockPluginEvent]);
    });
  });
});
