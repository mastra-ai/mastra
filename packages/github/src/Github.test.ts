
           import { describe, it, beforeAll, afterAll
          //expect
          } from '@jest/globals';
          import {Framework} from '@kpl/core';
          import {GithubIntegration} from '.'




          const API_KEY = '';
          const dbUri = 'postgresql://postgres:postgres@localhost:5432/kepler?schema=kepler';
          const referenceId = '1'

          const integrationName = 'GITHUB'

          const integrationFramework = Framework.init({
          name: 'TestFramework',
          integrations: [
            new GithubIntegration(),
          ],
          systemApis: [],
          systemEvents: {},
          db: {
            provider: 'postgres',
            uri: dbUri,
          },
          systemHostURL: 'http://localhost:3000',
          routeRegistrationPath: '/api/kepler',
          blueprintDirPath: '',
        });

      describe('github', () => {

        beforeAll(async () => {

    await integrationFramework.connectIntegrationByCredential({
      name: integrationName,
      referenceId,
      credential: {
        value: {
          API_KEY,
        },
        type: 'API_KEY',
      },
    })

        })


        it('should 200 on some apis',async()=>{
          //const client = await integration.getApiClient({ referenceId });
          //const response = await client['/2010-04-01/Accounts.json'].get();
          //expect(response.status).toBe(200);
        })

       afterAll(async()=>{

    await integrationFramework.disconnectIntegration({
      name: integrationName,
      referenceId,
    });

       })
      })
