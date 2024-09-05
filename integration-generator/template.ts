export function createPackageJson(name: string) {
  return {
    name: `@arkw/${name}`,
    version: '1.0.0',
    description: '',
    main: 'dist/index.js',
    module: 'dist/mylib.esm.js',
    typings: 'dist/index.d.ts',
    files: ['dist', 'src'],
    scripts: {
      analyze: 'size-limit --why',
      build: 'dts build',
      'build:dev': 'dts watch',
      lint: 'dts lint',
      prepare: 'dts build',
      size: 'size-limit',
      start: 'dts watch',
      test: 'jest',
    },
    husky: {
      hooks: {
        'pre-commit': 'dts lint',
      },
    },
    engines: {
      node: '>=20 <22',
    },
    'size-limit': [
      {
        path: 'dist/mylib.cjs.production.min.js',
        limit: '10 KB',
      },
      {
        path: 'dist/mylib.esm.js',
        limit: '10 KB',
      },
    ],
    devDependencies: {
      '@jest/globals': '^29.7.0',
      '@rollup/plugin-image': '^3.0.3',
      '@size-limit/preset-small-lib': '^11.1.4',
      '@tsconfig/recommended': '^1.0.7',
      '@types/jest': '^29.5.12',
      '@types/lodash': '^4.17.7',
      '@types/node': '^22.1.0',
      'dts-cli': '^2.0.5',
      husky: '^9.1.4',
      jest: '^29.7.0',
      'size-limit': '^11.1.4',
      'ts-jest': '^29.2.4',
      tslib: '^2.6.3',
      typescript: '^5.5.4',
    },
    keywords: [],
    author: '',
    license: 'ISC',
    dependencies: {
      '@arkw/core': 'workspace:*',
      fets: '*',
      zod: '^3.23.8',
    },
  };
}

export function createTsConfig() {
  return {
    extends: '@tsconfig/recommended/tsconfig.json',
    include: ['src', 'types'],
    compilerOptions: {
      lib: ['dom', 'esnext'],
      types: ['@types/jest', 'node'],
      target: 'ES6',
      module: 'ES2022',
      allowImportingTsExtensions: false,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      noUnusedLocals: true,
      noImplicitReturns: true,
      noFallthroughCasesInSwitch: true,
      declaration: true,
      sourceMap: true,
      disableSizeLimit: true,
      moduleResolution: 'Node',
    },
  };
}

export function createDtsConfig() {
  return `
import image from '@rollup/plugin-image';

export default {
  rollup(config, options) {
    config.plugins.push(image());
    return config;
  },
};
`;
}

export function generateIntegration({
  name,
  authType,
  entities,
  registeredEvents,
  eventHandlerImports,
  configKeys,
}: {
  name: string;
  authType: string
  eventHandlerImports?: string
  entities?: Record<string, string>;
  registeredEvents?: string;
  configKeys?: string[]
}) {
  let config = `
    type ${name}Config = {
      CLIENT_ID: string;
      CLIENT_SECRET: string;
      [key: string]: any;
    };  
  `

  if (configKeys && configKeys?.length > 0) {
    config = `
    type ${name}Config = {
      ${configKeys.map(key => `${key}: string;`).join('\n')}
      [key: string]: any;
    };  
  `
  }

  return `
    import { Integration, OpenAPI, IntegrationCredentialType } from '@arkw/core';
    import { z } from 'zod'
    import openapi from './openapi'
    ${eventHandlerImports ? eventHandlerImports : ''}
    // @ts-ignore
    import ${name}Logo from './assets/${name?.toLowerCase()}.svg';

    ${config}
    
    export class ${name}Integration extends Integration {
      ${entities ? `entityTypes = ${JSON.stringify(entities)}` : ``}


      constructor({ config }: { config: ${name}Config }) {
        super({
          ...config,
          authType: IntegrationCredentialType.${authType},
          name: '${name.toUpperCase()}',
          logoUrl: ${name}Logo,
        });
      }

      getOpenApiSpec() {
        return openapi as unknown as OpenAPI;
      }

      registerEvents() {
        this.events = {
        ${registeredEvents}
        }
        return this.events;
      }
    }
  `;
}

export function eventHandler({ idKey, returnType, opId, apiPath, entityType, name, queryParams, pathParams }: { idKey: string, returnType: string, apiPath: string, queryParams: string[], pathParams: string[], opId: string, name: string, entityType: string }) {
  const eventParams = [...queryParams, ...pathParams].join(', ')
  let query = ``

  if (queryParams.length > 0) {
    query = `query: { ${queryParams.join(', ')} },`
  }

  let params = ``

  if (pathParams.length > 0) {
    params = `params: { ${pathParams.join(', ')} },`
  }
  return `
    import { EventHandler } from '@arkw/core';
    import { ${entityType}Fields } from '../constants';
    import { ${name}Integration } from '..';

    export const ${opId}: EventHandler<${name}Integration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: \`\${name}-sync-${entityType}-${opId}\`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          ${eventParams ? `const { ${eventParams} } = event.data;` : ``}
          const proxy = await getApiClient({ referenceId })        

          const response = await proxy['${apiPath}'].get({
            ${params}
            ${query}
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching ${opId}", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()

          const records = ${returnType === `object` ? `[d]` : `d`}.map((r) => {
            return {
              externalId: r.${idKey},
              record: r,
              entityType: ${entityType}Fields,
            } 
          })

          await dataLayer?.syncData({
              name,
              referenceId,
              data: records,
              type: \`${entityType}\`,
              properties: ${entityType}Fields,
          });          
        }
    });
  `
}

export function createIntegration({
  name,
  server,
  authEndpoint,
  tokenEndpoint,
  syncFuncImports,
  syncFuncs,
  apiEndpoint,
}: {
  apiEndpoint: string;
  syncFuncImports: string;
  syncFuncs: string;
  name: string;
  server: string;
  authEndpoint: string;
  tokenEndpoint: string;
}) {
  return `
import { Integration, IntegrationAuth, OpenAPI } from '@arkw/core';
import { createClient, type OASClient, type NormalizeOAS } from 'fets'
// @ts-ignore
import ${name}Logo from './assets/${name?.toLowerCase()}.svg';
import { z } from 'zod'
import openapi from './openapi'
${syncFuncImports}

type ${name}Config = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  [key: string]: any;
};

export class ${name}Integration extends Integration {
  config: ${name}Config;

  constructor({ config }: { config: ${name}Config }) {
    config.authType = \`OAUTH\`;

    super({
      ...config,
      name: '${name.toUpperCase()}',
      logoUrl: ${name}Logo,
    });

    this.config = config;
  }

  registerEvents() {
    ${syncFuncs}
    return this.events;
  }

  getOpenApiSpec() {
    return openapi as unknown as OpenAPI;
  }

  getApiClient = async ({ referenceId }: { referenceId: string }): Promise<OASClient<NormalizeOAS<typeof openapi>>> => {
    const connection = await this.dataLayer?.getConnectionByReferenceId({ name: this.name, referenceId })

    if (!connection) {
      throw new Error(\`Connection not found for referenceId: \${referenceId}\`)
    }

     const authenticator = this.getAuthenticator();
    const token = await authenticator.getAuthToken({ connectionId: connection.id });

    const client = createClient<NormalizeOAS<typeof openapi>>({
      endpoint: "${apiEndpoint}",
      globalParams: {
        headers: {
          Authorization: \`Bearer \${token.accessToken}\`
        }
      }
    })

    return client
  }

  getAuthenticator() {
    return new IntegrationAuth({
      dataAccess: this.dataLayer!,
      // @ts-ignore
      onConnectionCreated: () => {
        // TODO
      },
      config: {
        INTEGRATION_NAME: this.name,
        AUTH_TYPE: this.config.authType,
        CLIENT_ID: this.config.CLIENT_ID,
        CLIENT_SECRET: this.config.CLIENT_SECRET,
        REDIRECT_URI: this.config.REDIRECT_URI || this.corePresets.redirectURI,
        SERVER: \`${server}\`,
        AUTHORIZATION_ENDPOINT: '${authEndpoint}',
        TOKEN_ENDPOINT: '${tokenEndpoint}',
        SCOPES: [],
      },
    });
  }
}
    `;
}

export const createIntegrationTest = ({ name, sentenceCasedName }: { name: string; sentenceCasedName: string }) => {
  return `
          import { describe, expect, it } from '@jest/globals';
          import {createFramework, EventHandlerExecutorParams} from '@arkw/core';
          import {${sentenceCasedName}Integration} from '..'
          import { ZodSchema, ZodObject, ZodString, ZodNumber, ZodBoolean, ZodArray, ZodEnum, ZodOptional, ZodUnion, ZodLiteral} from 'zod';


          const CLIENT_ID=''
          const CLIENT_SECRET=''
          const dbUri = 'postgresql://postgres:postgres@localhost:5432/arkwright?schema=arkw';
          const referenceId = '1'

          const integrationName = '${name.toUpperCase()}'

          const integrationFramework = createFramework({
          name: 'TestFramework',
          integrations: [
            new ${sentenceCasedName}Integration({
             config: {
              CLIENT_ID,
              CLIENT_SECRET,
            }
            }),
          ],
          systemApis: [],
          systemEvents: {},
          db: {
            provider: 'postgres',
            uri: dbUri,
          },
          systemHostURL: '',
          routeRegistrationPath: '/api/arkw',
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
              return "1208172064188957";
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

          return {}
        }

         
      describe('${name}', () => {

       describe('events', () => {
        
         it('should have events', () => {
          expect(integrationEvents).toBeDefined();
        });
      
        for (const event of Object.entries(integrationEvents ?? {})) {
      const [key, value] = event;

      it(\`should send event: \${key}\`, async () => {
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

      it(\`should hit event handler for event: \${key}\`, async () => {
        const handler = value?.handler;
        const schema = value?.schema;

        if (!handler) {
          console.log(\`No handler found for \${integrationName} event:\`, key);
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
       })

       describe('apis', () => {
         it('should have APIs', () => {
          expect(integrationAPIs).toBeDefined();
        });

        for (const api of Object.values(integrationAPIs ?? {})) {
          it(\`should hit APIs: \${api.type}\`, async () => {
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

       })
      })
     
     `;
};

export const createIntegrationJestConfig = ({ modulePath }: { modulePath: string }) => {
  return `
       /** @type {import('ts-jest').JestConfigWithTsJest} **/
        module.exports = {
          testEnvironment: 'node',
          transform: {
            '^.+.tsx?$': ['ts-jest', {}],
            '^.+\\.svg$': '<rootDir>/svgTransform.js',
          },
        };
        `;
};

export const createSvgTransformer = ({ modulePath }: { modulePath: string }) => {
  return `
        module.exports = {
          process() {
            return {
              code: \`module.exports = {};\`,
                  };
                },
                getCacheKey() {
                  // The output is always the same.
                  return "svgTransform";
              },
         };
        `;
};
