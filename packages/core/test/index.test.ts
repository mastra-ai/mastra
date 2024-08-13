import { describe, expect, it } from '@jest/globals';
import { z } from 'zod';

import { CORE_PLUGIN_NAME, createFramework } from '../src';

import { IntegrationAction, IntegrationEvent } from '../src/types';
import { IntegrationPlugin } from '../src/plugin';

const testFrameworkName = 'TEST_FRAMEWORK';
const testPluginName = 'TEST_PLUGIN';
const testActionType = 'TEST_ACTION';
const testEventKey = 'TEST_EVENT';
const testPluginEventKey = 'TEST_PLUGIN_EVENT';
const testPluginActionType = 'TEST_PLUGIN_ACTION';

const createMockAction = (type: string, pluginName: string) => ({
  pluginName: pluginName,
  schema: z.object({}),
  outputSchema: z.object({}),
  type,
  label: 'test',
  description: 'test',
  category: 'test',
  executor: async () => {},
  isHidden: false,
});

const createMockEvent = (key: string) => ({
  key,
  schema: z.object({}),
  triggerProperties: {
    type: key,
    label: 'test',
    description: 'test',
  },
});

const mockSystemActions: IntegrationAction[] = [
  createMockAction(testActionType, CORE_PLUGIN_NAME),
];

const mockSystemEvents: IntegrationEvent[] = [createMockEvent(testEventKey)];

const mockPluginAction: IntegrationAction = createMockAction(
  testPluginActionType,
  testPluginName
);

const mockPluginEvent: IntegrationEvent = createMockEvent(testPluginEventKey);

class MockPlugin extends IntegrationPlugin {
  constructor() {
    super({
      name: testPluginName,
      logoUrl: 'test',
    });
  }

  defineEvents() {
    this.events = {
      [testPluginEventKey]: mockPluginEvent,
    };
  }

  defineActions() {
    this.actions = {
      [testPluginActionType]: mockPluginAction,
    };
  }
}

const integrationFramework = createFramework({
  name: testFrameworkName,
  plugins: [new MockPlugin()],
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
      expect(Object.values(actions ?? {})).toEqual([mockPluginAction]);
    });

    it('Should register plugin events', () => {
      const events = integrationFramework.getEventsByPlugin(testPluginName);
      expect(events).toBeDefined();
      expect(Object.values(events ?? {})).toEqual([mockPluginEvent]);
    });
  });
});
