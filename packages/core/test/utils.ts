import { z } from 'zod';
import { IntegrationPlugin } from '../src/plugin';
import { IntegrationAction, IntegrationEvent } from '../src';

export const createMockAction = (type: string, pluginName: string) => ({
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

export const createMockEvent = (key: string) => ({
  key,
  schema: z.object({}),
  triggerProperties: {
    type: key,
    label: 'test',
    description: 'test',
  },
});

export class MockPlugin extends IntegrationPlugin {
  mockEvents: Record<string, IntegrationEvent> = {};
  mockActions: Record<string, IntegrationAction> = {};

  testPluginEventKey = 'TEST_PLUGIN_EVENT';
  testPluginActionType = 'TEST_PLUGIN_ACTION';
  testActionType = 'TEST_ACTION';

  constructor({
    name,
    events,
    actions,
    logoUrl = 'test',
  }: {
    name: string;
    logoUrl: string;
    events?: Record<string, IntegrationEvent>;
    actions?: Record<string, IntegrationAction>;
  }) {
    super({
      name,
      logoUrl,
    });
    this.mockEvents = events || {};
    this.mockActions = actions || {};
  }

  defineEvents() {
    const mockPluginEvent: IntegrationEvent = createMockEvent(
      this.testPluginEventKey
    );
    this.events = {
      [this.testPluginEventKey]: mockPluginEvent,
      ...this.mockEvents,
    };
  }

  defineActions() {
    const mockPluginAction: IntegrationAction = createMockAction(
      this.testPluginActionType,
      this.name
    );
    this.actions = {
      ...this.mockActions,
      [this.testPluginActionType]: mockPluginAction,
    };
  }
}
