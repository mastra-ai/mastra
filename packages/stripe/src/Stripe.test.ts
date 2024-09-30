import {
  describe,
  it,
  beforeAll,
  afterAll, //expect
} from '@jest/globals';
import { Framework } from '@kpl/core';

import { StripeIntegration } from '.';

// const API_KEY = process.env.API_KEY!;
// const dbUri = process.env.DB_URL!;
// const connectionId = process.env.CONNECTION_ID!;

const integrationName = 'STRIPE';

const integrationFramework = Framework.init({
  name: 'TestFramework',
  integrations: [new StripeIntegration()],
  workflows: {
    systemApis: [],
    blueprintDirPath: '',
    systemEvents: {},
  },
  db: {
    provider: 'postgres',
    uri: `postgresql://postgres:postgres@localhost:5434/kepler?schema=kepler`,
  },
  systemHostURL: 'http://localhost:3000',
  routeRegistrationPath: '/api/kepler',
});

//const integration = integrationFramework.getIntegration(integrationName) as StripeIntegration

describe('stripe', () => {
  // beforeAll(async () => {
  //   await integrationFramework.connectIntegrationByCredential({
  //     name: integrationName,
  //     connectionId,
  //     credential: {
  //       value: {
  //         API_KEY,
  //       },
  //       type: 'API_KEY',
  //     },
  //   });
  // });

  it('generation', () => {
    const e = integration.registerEvents();

    const eventObj = e?.['stripe.prices/sync']

    if (eventObj?.handler) {
      console.log('yoooo')
      eventObj?.handler({
        eventKey: 'stripe.prices/sync',
        integrationInstance: integration,
        makeWebhookUrl: () => 'http://localhost:3000' as any,
      }).executor({ event: { name: 'foo', user: { connectionId: `123`} }} as any)
    }
  })

  // it('test', async () => {
  //   integration._convertApiClientToSystemApis();
  // });

  it('should 200 on some apis', async () => {
    //const client = await integration.getApiClient({ connectionId });
    //const response = await client['/2010-04-01/Accounts.json'].get();
    //expect(response.status).toBe(200);
  });

  afterAll(async () => {
    await integrationFramework.disconnectIntegration({
      name: integrationName,
      connectionId,
    });
  });
});
