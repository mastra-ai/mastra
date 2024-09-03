import { z } from 'zod';
import { Integration } from '../src/integration';
import { IntegrationApi, IntegrationEvent } from '../src';

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

export const createMockEvent = ({
  key,
  ...props
}: {
  key: string;
  schema?: any;
  outputSchema?: any;
}): Record<string, IntegrationEvent<any>> => ({
  [key]: {
    schema: z.object({}),
    label: 'test',
    description: 'test',
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
    apis,
    logoUrl = 'test',
  }: {
    name: string;
    logoUrl: string;
    events?: Record<string, IntegrationEvent<MockIntegration>>;
    apis?: Record<string, IntegrationApi>;
  }) {
    super({
      name,
      logoUrl,
    });
    this.events = events || {};
    this.apis = apis || {};
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

  registerApis() {
    const mockAction: IntegrationApi = createMockAction({
      type: this.testPluginActionType,
      integrationName: this.name,
    });

    this.apis = {
      ...this.apis,
      [this.testPluginActionType]: mockAction,
    };

    return this.apis;
  }
}
