import { normalizeString } from './utils';

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
  server,
  apiEndpoint,
  authEndpoint,
  tokenEndpoint,
  authorization,
}: {
  name: string;
  authType: string;
  eventHandlerImports?: string;
  entities?: Record<string, string>;
  registeredEvents?: string;
  configKeys?: string[];
  server?: string;
  apiEndpoint: string;
  authEndpoint?: string;
  tokenEndpoint?: string;
  authorization: {
    type: string;
    usernameKey: string;
    passwordKey?: string;
  };
}) {
  const isConfigKeysDefined = configKeys && configKeys?.length > 0;
  // config
  let config = `
    type ${name}Config = {
      CLIENT_ID: string;
      CLIENT_SECRET: string;
      [key: string]: any;
    };
  `;

  if (isConfigKeysDefined) {
    config = ``;
  }

  // constructor
  let constructor = `constructor({ config }: { config: ${name}Config }) {
        super({
          ...config,
          authType: IntegrationCredentialType.${authType},
          name: '${name.toUpperCase()}',
          logoUrl: ${name}Logo,
        });
      }`;

  if (isConfigKeysDefined) {
    constructor = `
    constructor() {
        super({
          authType: IntegrationCredentialType.${authType},
          name: '${name.toUpperCase()}',
          logoUrl: ${name}Logo,
          authConnectionOptions: z.object({
          ${configKeys.map(key => `${key}: z.string(),`).join('\n')}
         })
        });
      }
    `;
  }

  // authenticator
  let authenticator = ``;

  if (authType === 'OAUTH') {
    authenticator = `
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
    `;
  } else if (authType === 'API_KEY') {
    authenticator = `
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
        },
      });
    }
    `;
  }

  // getApiClient
  let getApiClient = '';

  if (authorization?.type === `Basic`) {
    let basicAuth = ``;
    if (authorization.passwordKey) {
      basicAuth = `\${btoa(\`\${value?.['${authorization.usernameKey}']}:\${value?.['${authorization.passwordKey}']}\`)}`;
    } else {
      basicAuth = `\${btoa(\`\${value?.['${authorization.usernameKey}']}\`)}`;
    }

    getApiClient = `
  getApiClient = async ({ referenceId }: { referenceId: string }) => {
    const connection = await this.dataLayer?.getConnectionByReferenceId({ name: this.name, referenceId })

    if (!connection) {
      throw new Error(\`Connection not found for referenceId: \${referenceId}\`)
    }

     const credential = await this.dataLayer?.getCredentialsByConnectionId(connection.id)
     const value = credential?.value as Record<string, string>

    const client = createClient<NormalizeOAS<typeof openapi>>({
      endpoint: "${apiEndpoint}",
      globalParams: {
        headers: {
          Authorization: \`Basic ${basicAuth}\`
        }
      }
    })

    return client 
  }
    `;
  } else {
    getApiClient = `
    getApiClient = async ({ referenceId }: { referenceId: string })=> {
      const connection = await this.dataLayer?.getConnectionByReferenceId({ name: this.name, referenceId })
  
      if (!connection) {
        throw new Error(\`Connection not found for referenceId: \${referenceId}\`)
      }
  
       const credential = await this.dataLayer?.getCredentialsByConnectionId(connection.id)
       const value = credential?.value as Record<string, string>
  
      const client = createClient<NormalizeOAS<typeof openapi>>({
        endpoint: "${apiEndpoint}",
        globalParams: {
          headers: {
            Authorization: \`Bearer \${value}\`
          }
        }
      })
  
      return client
    }
      `;
  }

  return `
    import { Integration, OpenAPI, IntegrationCredentialType, IntegrationAuth } from '@arkw/core';
    import { createClient,type NormalizeOAS } from 'fets'
    import openapi from './openapi'
    ${eventHandlerImports ? eventHandlerImports : ''}
    // @ts-ignore
    import ${name}Logo from './assets/${name?.toLowerCase()}.svg';
    ${isConfigKeysDefined ? `import { z } from 'zod';` : ``}

    ${config}

    export class ${name}Integration extends Integration {
      ${entities ? `entityTypes = ${JSON.stringify(entities)}` : ``}


      ${constructor}

      getOpenApiSpec() {
        return openapi as unknown as OpenAPI;
      }

      ${getApiClient}

      registerEvents() {
        this.events = {
        ${registeredEvents ? registeredEvents : ``}
        }
        return this.events;
      }

      ${authenticator}
    }
  `;
}

export function eventHandler({
  idKey,
  returnType,
  opId,
  apiPath,
  entityType,
  name,
  queryParams,
  pathParams,
}: {
  idKey: string;
  returnType: string;
  apiPath: string;
  queryParams: string[];
  pathParams: string[];
  opId: string;
  name: string;
  entityType: string;
}) {
  const eventParams = normalizeString([...queryParams, ...pathParams]).join(', ');
  let query = ``;

  if (queryParams.length > 0) {
    query = `query: { ${normalizeString(queryParams).join(', ')} },`;
  }

  let params = ``;

  if (pathParams.length > 0) {
    params = `params: { ${pathParams.join(', ')} },`;
  }
  return `
    import { EventHandler } from '@arkw/core';
    import { ${entityType}Fields } from '../constants';
    import { ${name}Integration } from '..';

    export const ${opId}: EventHandler<${name}Integration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient, config },
      makeWebhookUrl,
    }) => ({
        id: \`\${name}-sync-${entityType}-${opId}\`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          ${eventParams ? `const { ${eventParams} } = event.data;` : ``}
          const proxy = await getApiClient({ referenceId })

          // @ts-ignore
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

          const records = ${returnType === `object` ? `[d]` : `d?.['${returnType}']`}?.map((r) => {
            return {
              externalId: ${idKey},
              data: r,
              entityType: '${entityType}',
            }
          })

          if (records && records?.length > 0) {
            await dataLayer?.syncData({
                name,
                referenceId,
                data: records,
                type: \`${entityType}\`,
                properties: ${entityType}Fields,
            });
          }
        }
    });
  `;
}

export const createIntegrationTest = ({
  name,
  sentenceCasedName,
  configKeys,
  authType,
}: {
  name: string;
  sentenceCasedName: string;
  configKeys?: string[];
  authType: string;
}) => {
  let intitalizationConfig = ``;

  if (authType === 'OAUTH') {
    intitalizationConfig = `
  {
    config: {
      CLIENT_ID,
      CLIENT_SECRET,
   }
  }
  `;
  }

  let beforeAll = `
    await integrationFramework.connectIntegrationByCredential({
      name: integrationName,
      referenceId,
      credential: {
        value: {
          ACCOUNT_SID,
          AUTH_TOKEN,
        },
        type: 'API_KEY',
      },
    })
    `;

  let afterAll = `
    await integrationFramework.disconnectIntegration({
      name: integrationName,
      referenceId,
    });
  `;

  if (authType === 'OAUTH') {
    beforeAll = ``;
    afterAll = ``;
  }

  let comments = [];

  if (authType === 'OAUTH') {
    comments.push(`// We need to OAuth from admin`);
  }

  return `
          import { describe, it, 
          //expect
          } from '@jest/globals';
          import {createFramework} from '@arkw/core';
          import {${sentenceCasedName}Integration} from '.'

          ${comments.join('\n')}

          ${configKeys?.map(key => `const ${key} = '';`).join('\n')}
          const dbUri = 'postgresql://postgres:postgres@localhost:5432/arkwright?schema=arkw';
          const referenceId = '1'

          const integrationName = '${name.toUpperCase()}'

          const integrationFramework = createFramework({
          name: 'TestFramework',
          integrations: [
            new ${sentenceCasedName}Integration(${intitalizationConfig}),
          ],
          systemApis: [],
          systemEvents: {},
          db: {
            provider: 'postgres',
            uri: dbUri,
          },
          systemHostURL: 'http://localhost:3000',
          routeRegistrationPath: '/api/arkw',
          blueprintDirPath: '',
        });

        //const integration = integrationFramework.getIntegration(integrationName) as ${sentenceCasedName}Integration
       

      describe('${name}', () => {

        beforeAll(async () => {
          ${beforeAll}
        })


        it('should 200 on some apis',async()=>{
          //const client = await integration.getApiClient({ referenceId });
          //const response = await client['/2010-04-01/Accounts.json'].get();
          //expect(response.status).toBe(200);
        })

       afterAll(async()=>{
          ${afterAll}
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
