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
      logoUrl: "TODO",
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

    // TODO: HANDLE REFRESH TOKEN IF EXPIRED
    const credential = await this.dataLayer?.getCredentialsByConnectionId(connection.id)

    const client = createClient<NormalizeOAS<typeof openapi>>({
      endpoint: "${apiEndpoint}",
      globalParams: {
        headers: {
          Authorization: \`Bearer \${credential?.value}\`
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
