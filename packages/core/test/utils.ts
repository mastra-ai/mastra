import { z } from 'zod';
import { Integration } from '../src/integration';
import { IntegrationAction, IntegrationEvent } from '../src';

export const createMockAction = (props: {
  type: string;
  integrationName: string;
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
}): Record<string, IntegrationEvent<any>> => ({
  key: {
    schema: z.object({}),
    triggerProperties: {
      schema: props.schema || z.object({}),
      type: props.key,
      label: 'test',
      description: 'test',
    },
    handler: ({ eventKey }) => ({
      event: eventKey,
      executor: async () => {},
      id: '',
    }),
    ...props,
  },
});

export class MockIntegration extends Integration {
  testPluginEventKey = 'TEST_INTEGRATION_EVENT';
  testPluginActionType = 'TEST_INTEGRATION_ACTION';
  testActionType = 'TEST_ACTION';

  constructor({
    name,
    events,
    actions,
    logoUrl = 'test',
  }: {
    name: string;
    logoUrl: string;
    events?: Record<string, IntegrationEvent<MockIntegration>>;
    actions?: Record<string, IntegrationAction>;
  }) {
    super({
      name,
      logoUrl,
    });
    this.events = events || {};
    this.actions = actions || {};
  }

  registerEvents() {
    const mockPluginEvent: Record<
      string,
      IntegrationEvent<MockIntegration>
    > = createMockEvent({
      key: this.testPluginEventKey,
    });
    this.events = {
      ...mockPluginEvent,
      ...this.events,
    };

    return this.events;
  }

  registerActions() {
    const mockAction: IntegrationAction = createMockAction({
      type: this.testPluginActionType,
      integrationName: this.name,
    });

    this.actions = {
      ...this.actions,
      [this.testPluginActionType]: mockAction,
    };

    return this.actions;
  }
}
