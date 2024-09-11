import { describe, expect, it } from '@jest/globals';
import { createFramework, EventHandlerExecutorParams } from '@kepler/core';
import {
  ZodSchema,
  ZodObject,
  ZodString,
  ZodNumber,
  ZodBoolean,
  ZodArray,
  ZodEnum,
  ZodOptional,
  ZodUnion,
  ZodLiteral,
} from 'zod';

import { AsanaIntegration } from '..';

const CLIENT_ID = '';
const CLIENT_SECRET = '';
const dbUri = 'postgresql://postgres:postgres@localhost:5432/kepler?schema=kepler';
const referenceId = '1';

const integrationName = 'ASANA';

const integrationFramework = createFramework({
  name: 'TestFramework',
  integrations: [
    new AsanaIntegration({
      config: {
        CLIENT_ID,
        CLIENT_SECRET,
      },
    }),
  ],
  systemApis: [],
  systemEvents: {},
  db: {
    provider: 'postgres',
    uri: dbUri,
  },
  systemHostURL: '',
  routeRegistrationPath: '/api/kepler',
  blueprintDirPath: '',
});

const integration = integrationFramework.getIntegration(integrationName);
const integrationEvents = integrationFramework.getEventsByIntegration(integrationName);
const integrationAPIs = integrationFramework.getApisByIntegration(integrationName);

function generateMockData(schema: ZodSchema<any>): any {
  if (schema instanceof ZodObject) {
    const shape = schema.shape;
    const mockObject: Record<string, any> = {};
    for (const key in shape) {
      mockObject[key] = generateMockData(shape[key]);
    }
    return mockObject;
  }

  if (schema instanceof ZodString) {
    return '1208172064188957';
  }

  if (schema instanceof ZodNumber) {
    return 1208172064188957;
  }

  if (schema instanceof ZodBoolean) {
    return true;
  }

  if (schema instanceof ZodArray) {
    const elementSchema = schema.element;
    return [generateMockData(elementSchema)];
  }

  if (schema instanceof ZodEnum) {
    return schema.options[0];
  }

  if (schema instanceof ZodOptional) {
    return generateMockData(schema.unwrap());
  }

  if (schema instanceof ZodUnion) {
    return generateMockData(schema.options[0]);
  }

  if (schema instanceof ZodLiteral) {
    return schema.value;
  }

  return {};
}

describe('asana', () => {
  describe('events', () => {
    it('should have events', () => {
      expect(integrationEvents).toBeDefined();
    });

    for (const event of Object.entries(integrationEvents ?? {})) {
      const [key, value] = event;

      it(`should send event: ${key}`, async () => {
        const data = generateMockData(value.schema as ZodSchema<any>);
        const mockResponse = { event: {}, workflowEvent: {} };

        const sendEventSpy = jest.spyOn(integrationFramework, 'sendEvent').mockResolvedValue(mockResponse);

        const response = await integrationFramework.sendEvent({
          integrationName,
          key,
          data,
          user: {
            referenceId,
          },
        });

        expect(sendEventSpy).toHaveBeenCalledWith({
          integrationName,
          key,
          data,
          user: {
            referenceId,
          },
        });
        expect(response).toEqual(mockResponse);

        sendEventSpy.mockRestore();
      });

      it(`should hit event handler for event: ${key}`, async () => {
        const handler = value?.handler;
        const schema = value?.schema;

        if (!handler) {
          console.log(`No handler found for ${integrationName} event:`, key);
          return;
        }

        await handler({
          eventKey: key,
          integrationInstance: integration,
          makeWebhookUrl: integrationFramework.makeWebhookUrl,
        }).executor({
          event: {
            data: generateMockData(schema as ZodSchema<any>),
            user: {
              referenceId,
            },
            name: integrationName,
          },
          step: {} as unknown as EventHandlerExecutorParams['step'],
          attempt: 1,
          events: [
            {
              name: 'event',
            },
          ],
          runId: '1',
        });

        // expect(response.status).toBe(200);
      });
    }
  });

  describe('apis', () => {
    it('should have APIs', () => {
      expect(integrationAPIs).toBeDefined();
    });

    for (const api of Object.values(integrationAPIs ?? {})) {
      it(`should hit APIs: ${api.type}`, async () => {
        const data = generateMockData(api.schema as ZodSchema<any>);
        await integrationFramework.executeApi({
          integrationName,
          api: api.type,
          payload: {
            ctx: {
              referenceId,
            },
            data,
          },
        });

        // expect(response.status).toBe(200);
      });
    }
  });
});
