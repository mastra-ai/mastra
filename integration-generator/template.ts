import { normalizeString } from './utils';

export function createPackageJson(name: string) {
  return {
    name: `@mastra/${name}`,
    version: '1.0.0',
    description: '',
    main: 'dist/index.js',
    module: 'dist/mylib.esm.js',
    typings: `dist/${name}/src/index.d.ts`,
    files: ['dist', 'src'],
    scripts: {
      analyze: 'size-limit --why',
      build: 'dts build',
      'build:dev': 'dts watch',
      lint: 'dts lint',
      size: 'size-limit',
      start: 'dts watch',
      test: 'jest',
      clean: 'rm -rf dist && rm -rf node_modules',
      'gen:zod:schema': 'pnpx ts-to-zod  src/client/types.gen.ts src/client/zodSchema.ts',
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
      '@hey-api/client-fetch': '^0.3.3',
      '@mastra/core': 'workspace:^',
      zod: '^3.23.8',
      'ts-to-zod': '^3.13.0',
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
      noUncheckedIndexedAccess: true,
      declaration: true,
      declarationMap: true,
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
  apiKeys,
  server,
  logoFormat,
  apiEndpoint,
  authEndpoint,
  tokenEndpoint,
  authorization,
  scopes,
  categories,
  description,
}: {
  name: string;
  authType: string;
  eventHandlerImports?: string;
  entities?: Record<string, string>;
  registeredEvents?: string;
  configKeys?: string[];
  apiKeys?: string[];
  server?: string;
  apiEndpoint: string;
  logoFormat: string;
  authEndpoint?: string;
  tokenEndpoint?: string;
  authorization?:
    | {
        type: 'Basic';
        usernameKey: string;
        passwordKey?: string;
      }
    | {
        type: 'Custom_Header';
        headers: {
          key: string;
          value: string;
        }[];
      }
    | { type: 'Bearer'; tokenKey: string };
  scopes?: Record<string, string>;
  categories?: string[];
  description?: string;
}) {
  let config = `
    type ${name}Config = {
      CLIENT_ID: string;
      CLIENT_SECRET: string;
      ${configKeys ? configKeys.map(key => `${key}: string`).join('\n      ') : ``}
      [key: string]: any;
    };
  `;

  const isApiKeysDefined = apiKeys && apiKeys?.length > 0;
  const isScopesDefined = scopes && Object.keys(scopes).length > 0;

  // constructor
  let constructor = `constructor({ config }: { config: ${name}Config }) {
        super({
          ...config,
          authType: IntegrationCredentialType.${authType},
          name: '${name.toUpperCase()}',
          logoUrl: ${name}Logo,
        });
      }`;

  if (isApiKeysDefined) {
    constructor = `
    constructor() {
        super({
          authType: IntegrationCredentialType.${authType},
          name: '${name.toUpperCase()}',
          logoUrl: ${name}Logo,
          authConnectionOptions: z.object({
          ${apiKeys.map(key => `${key}: z.string(),`).join('\n')}
         })
        });
      }
    `;

    config = ``;
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
          AUTHORIZATION_ENDPOINT: \`${authEndpoint}\`,
          TOKEN_ENDPOINT: \`${tokenEndpoint}\`,
          SCOPES: this.config.SCOPES || [],
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
    getApiClient = async ({ connectionId }: { connectionId: string })=> {
    const connection = await this.dataLayer?.getConnection({ name: this.name, connectionId })

    if (!connection) {
      throw new Error(\`Connection not found for connectionId: \${connectionId}\`)
    }

     const credential = await this.dataLayer?.getCredentialsByConnection(connection.id)
     const value = credential?.value as Record<string, any>


     const baseClient = this.getBaseClient();

    baseClient.client.interceptors.request.use((request, options) => {
      request.headers.set('Authorization', \`Basic \${btoa(\`\${value?.['API_KEY']}\`)}\`);
      return request;
    });

    return integrationClient;
    }
    `;
  } else if (authorization?.type === 'Bearer') {
    getApiClient = `
    getApiClient = async ({ connectionId }: { connectionId: string }) => {
      const connection = await this.dataLayer?.getConnection({ name: this.name, connectionId })

      if (!connection) {
        throw new Error(\`Connection not found for connectionId: \${connectionId}\`)
      }

      const credential = await this.dataLayer?.getCredentialsByConnection(connection.id)
     const value = credential?.value as Record<string, any>

      const baseClient = this.getBaseClient();

      baseClient.client.interceptors.request.use((request, options) => {
        request.headers.set('Authorization', \`Bearer \${value?.['${authorization.tokenKey}']}\`);
        return request;
      });

      return integrationClient;
  }

      `;
  } else if (authorization?.type === 'Custom_Header') {
    getApiClient = `
    getApiClient = async ({ connectionId }: { connectionId: string }) => {
      const connection = await this.dataLayer?.getConnection({ name: this.name, connectionId })

      if (!connection) {
        throw new Error(\`Connection not found for connectionId: \${connectionId}\`)
      }
     const credential = await this.dataLayer?.getCredentialsByConnection(connection.id)
     const value = credential?.value as Record<string, any>

      const baseClient = this.getBaseClient();

      baseClient.client.interceptors.request.use((request, options) => {
        ${authorization.headers
          .map(header => `request.headers.set('${header.key}', value?.['${header.value}'])`)
          .join('; \n ')}
        return request;
      });

      return integrationClient;

    }

    `;
  } else {
    getApiClient = `
    getApiClient = async ({ connectionId }: { connectionId: string })=> {
      const connection = await this.dataLayer?.getConnection({ name: this.name, connectionId })

      if (!connection) {
        throw new Error(\`Connection not found for connectionId: \${connectionId}\`)
      }

      const authenticator = this.getAuthenticator()
      const {accessToken} = await authenticator.getAuthToken({k_id: connection.id})


       const baseClient = this.getBaseClient();

      baseClient.client.interceptors.request.use((request, options) => {
        request.headers.set('Authorization',\`Bearer \${accessToken}\`);
        return request;
      });

      return integrationClient;
    }
      `;
  }

  return `
    import { Integration, IntegrationCredentialType, IntegrationAuth } from '@mastra/core';
    import * as zodSchema from './client/zodSchema';
    import * as integrationClient from './client/services.gen';
    import {comments} from './client/service-comments';
    ${eventHandlerImports ? eventHandlerImports : ''}
    // @ts-ignore
    import ${name}Logo from './assets/${name?.toLowerCase()}.${logoFormat}';
    ${isApiKeysDefined ? `import { z } from 'zod';` : ``}

    ${config}

    export class ${name}Integration extends Integration {
      ${entities ? `entityTypes = ${JSON.stringify(entities)}` : ``}
      ${categories ? `categories = ${JSON.stringify(categories)}` : ``}
      ${description ? `description = '${description}'` : ``}
      ${
        isScopesDefined
          ? `availableScopes = [${Object.entries(scopes)
              .map(
                ([k, v]) => `{
        key: \`${k}\`,
        description: \`${v}\`
        }`,
              )
              .join(', ')}]`
          : ``
      }

      ${constructor}

      getClientZodSchema() {
        return zodSchema;
      }

      getCommentsForClientApis() {
        return comments;
      }

      getBaseClient() {
        integrationClient.client.setConfig({
          baseUrl: \`${apiEndpoint}\`,
        });
        return integrationClient;
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
    import { EventHandler } from '@mastra/core';
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
          const { connectionId } = event.user;
          ${eventParams ? `const { ${eventParams} } = event.data;` : ``}
          const proxy = await getApiClient({ connectionId })

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
                connectionId,
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
  apiKeys,
  authType,
}: {
  name: string;
  sentenceCasedName: string;
  configKeys?: string[];
  apiKeys?: string[];
  authType: string;
}) => {
  let intitalizationConfig = ``;

  if (authType === 'OAUTH') {
    intitalizationConfig = `
  {
    config: {
      CLIENT_ID,
      CLIENT_SECRET,
      ${configKeys?.map(key => `${key}: '',`).join('\n')}
   }
  }
  `;
  }

  let beforeAll = `
    await integrationFramework.connectIntegrationByCredential({
      name: integrationName,
      connectionId,
      credential: {
        value: {
          ${apiKeys?.map(key => `${key},`).join('\n')}
        },
        type: 'API_KEY',
      },
    })
    `;

  let afterAll = `
    await integrationFramework.disconnectIntegration({
      name: integrationName,
      connectionId,
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

  let totalConfigKeys: string[] = [...(configKeys || [])];

  if (authType === 'OAUTH') {
    totalConfigKeys.push('CLIENT_ID', 'CLIENT_SECRET');
  }

  return `
           import { describe, it, beforeAll, afterAll
          //expect
          } from '@jest/globals';
          import {Mastra} from '@mastra/core';
          import {${sentenceCasedName}Integration} from '.'

          ${comments.join('\n')}

          ${totalConfigKeys?.map(key => `const ${key} = process.env.${key}!;`).join('\n')}
          ${(apiKeys || [])?.map(key => `const ${key} = process.env.${key}!;`).join('\n')}
          const dbUri = process.env.DB_URL!;
          const connectionId = process.env.CONNECTION_ID!;

          const integrationName = '${name.toUpperCase()}'

          const integrationFramework = Mastra.init({
          name: 'TestFramework',
          integrations: [
            new ${sentenceCasedName}Integration(${intitalizationConfig}),
          ],
          workflows: {
            systemApis: [],
            blueprintDirPath: '',
            systemEvents: {},
          },
          db: {
            provider: 'postgres',
            uri: dbUri,
          },
          systemHostURL: 'http://localhost:3000',
          routeRegistrationPath: '/api/mastra',
        });

        //const integration = integrationFramework.getIntegration(integrationName) as ${sentenceCasedName}Integration


      describe('${name}', () => {

        beforeAll(async () => {
          ${beforeAll}
        })


        it('should 200 on some apis',async()=>{
          //const client = await integration.getApiClient({ connectionId });
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
