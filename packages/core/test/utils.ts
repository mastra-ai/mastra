import { z } from 'zod';
import { IntegrationPlugin } from '../src/plugin';
import { IntegrationAction, IntegrationEvent } from '../src';

export const createMockAction = (props: {
  type: string;
  pluginName: string;
  executor?: any;
  schema?: any;
  outputSchema?: any;
}) => ({
  schema: z.object({}),
  outputSchema: z.object({}),
  label: 'test',
  description: 'test',
  category: 'test',
  executor: async () => {},
  isHidden: false,
  ...props,
});

export const createMockEvent = (props: {
  key: string;
  schema?: any;
  outputSchema?: any;
}) => ({
  schema: z.object({}),
  triggerProperties: {
    schema: props.schema || z.object({}),
    type: props.key,
    label: 'test',
    description: 'test',
  },
  ...props,
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
    const mockPluginEvent: IntegrationEvent = createMockEvent({
      key: this.testPluginEventKey,
    });
    this.events = {
      [this.testPluginEventKey]: mockPluginEvent,
      ...this.mockEvents,
    };
  }

  defineActions() {
    const mockPluginAction: IntegrationAction = createMockAction({
      type: this.testPluginActionType,
      pluginName: this.name,
    });
    this.actions = {
      ...this.mockActions,
      [this.testPluginActionType]: mockPluginAction,
    };
  }
}
