
           import { describe, it, beforeAll, afterAll
          //expect
          } from '@jest/globals';
          import {Framework} from '@kpl/core';
          import {ClickupIntegration} from '.'

          // We need to OAuth from admin

          const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
          undefined
          const dbUri = process.env.DB_URL!;
          const referenceId = process.env.REFERENCE_ID!;

          const integrationName = 'CLICKUP'

          const integrationFramework = Framework.init({
          name: 'TestFramework',
          integrations: [
            new ClickupIntegration(
  {
    config: {
      CLIENT_ID,
      CLIENT_SECRET,
      undefined
   }
  }
  ),
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

        //const integration = integrationFramework.getIntegration(integrationName) as ClickupIntegration


      describe('clickup', () => {

        beforeAll(async () => {
          
        })


        it('should 200 on some apis',async()=>{
          //const client = await integration.getApiClient({ referenceId });
          //const response = await client['/2010-04-01/Accounts.json'].get();
          //expect(response.status).toBe(200);
        })

       afterAll(async()=>{
          
       })
      })
     