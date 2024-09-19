import { execa } from 'execa';
import fs from 'fs';
import path from 'path';
import { parse } from 'yaml';

import omit from 'lodash/omit';

import {
  // createIntegrationJestConfig,
  // createIntegrationTest,
  createPackageJson,
  createSvgTransformer,
  createTsConfig,
  createDtsConfig,
  generateIntegration,
  createIntegrationTest,
  createIntegrationJestConfig,
} from './template';

function transformName(name: string) {
  return name
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('_');
}

function bootstrapDir(name: string) {
  const modulePath = path.join(process.cwd(), 'packages', name);

  // dir
  if (!fs.existsSync(modulePath)) {
    fs.mkdirSync(modulePath);
  }

  // write package.json
  const pkgJsonPath = path.join(modulePath, 'package.json');
  const pkgJsonDetails = createPackageJson(name);
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJsonDetails, null, 2));

  // write tsconfig
  const tsConfigPath = path.join(modulePath, 'tsconfig.json');
  fs.writeFileSync(tsConfigPath, JSON.stringify(createTsConfig(), null, 2));

  // dts.config.ts
  const dtsConfigPath = path.join(modulePath, 'dts.config.ts');
  fs.writeFileSync(dtsConfigPath, createDtsConfig());

  const srcPath = path.join(modulePath, 'src');

  if (!fs.existsSync(srcPath)) {
    fs.mkdirSync(srcPath);
  }

  return { modulePath, srcPath };
}

async function getOpenApiSpec({ openapiSpec, srcPath }: { srcPath: string; openapiSpec: string }) {
  const openapispecRes = await fetch(openapiSpec);
  const openapiSpecTest = await openapispecRes.text();
  let spec;
  if (openapiSpec.endsWith('.yaml')) {
    spec = parse(openapiSpecTest);
  } else {
    spec = JSON.parse(openapiSpecTest);
  }

  const trimmedSpec = omit(spec, ['info', 'tags', 'x-maturity']);

  // Write the openapi file
  fs.writeFileSync(
    path.join(srcPath, 'openapi-paths.ts'),
    `
      // @ts-nocheck
      export type TPaths = ${JSON.stringify(trimmedSpec?.paths, null, 2)}
      export const paths = ${JSON.stringify(trimmedSpec?.paths, null, 2)} as TPaths
    `,
  );

  fs.writeFileSync(
    path.join(srcPath, 'openapi-components.ts'),
    `
      // @ts-nocheck
      export type TComponents = ${JSON.stringify(trimmedSpec?.components, null, 2)}
      export const components = ${JSON.stringify(trimmedSpec?.components, null, 2)} as TComponents
    `,
  );

  // Write the openapi file
  fs.writeFileSync(
    path.join(srcPath, 'openapi.ts'),
    `
    // @ts-nocheck
    export type openapi = ${JSON.stringify(trimmedSpec, null, 2)}`,
  );

  return trimmedSpec;
}

function bootstrapAssetsDir(srcPath: string) {
  const eventsPath = path.join(srcPath, 'assets');

  if (!fs.existsSync(eventsPath)) {
    fs.mkdirSync(eventsPath);
  }

  return eventsPath;
}

async function writeAssets({ name, srcPath, logoDomain }: { name: string; srcPath: string; logoDomain?: string }) {
  const assetsPath = bootstrapAssetsDir(srcPath);

  const dummyAsset = `
<svg version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
	 viewBox="0 0 297.5 297.5" xml:space="preserve">
<g id="XMLID_40_">
	<g>
		<path style="fill:#ACBFC7;" d="M277.71,158.52v85.7H19.79v-85.7h6.53v40.54c0,16.98,13.81,30.78,30.78,30.78
			s30.78-13.8,30.78-30.78v-40.54h30.09v40.54c0,16.98,13.81,30.78,30.78,30.78c16.98,0,30.78-13.8,30.78-30.78v-40.54h30.1v40.54
			c0,16.98,13.8,30.78,30.78,30.78c16.97,0,30.78-13.8,30.78-30.78v-40.54H277.71z"/>
		<rect x="218.66" y="53.28" style="fill:#CDD9DD;" width="43.49" height="10.53"/>
		<rect x="229.17" y="83.35" style="fill:#CDD9DD;" width="22.48" height="23.92"/>
		<rect x="137.51" y="83.35" style="fill:#CDD9DD;" width="22.48" height="23.92"/>
		<rect x="127.01" y="53.28" style="fill:#CDD9DD;" width="43.49" height="10.53"/>
		<rect x="35.35" y="53.28" style="fill:#CDD9DD;" width="43.49" height="10.53"/>
		<rect x="45.86" y="83.35" style="fill:#CDD9DD;" width="22.48" height="23.92"/>
		<path style="fill:#FF4855;" d="M251.65,126.81v72.25c0,6.2-5.05,11.24-11.24,11.24c-6.2,0-11.24-5.04-11.24-11.24v-72.25H251.65z"
			/>
		<path style="fill:#D61616;" d="M68.34,126.81v72.25c0,6.2-5.04,11.24-11.24,11.24s-11.24-5.04-11.24-11.24v-72.25H68.34z"/>
		<path style="fill:#FFD63F;" d="M159.99,126.81v72.25c0,6.2-5.04,11.24-11.24,11.24s-11.24-5.04-11.24-11.24v-72.25H159.99z"/>
		<path d="M297.25,148.75v105.24c0,5.4-4.37,9.77-9.77,9.77H10.02c-5.39,0-9.77-4.37-9.77-9.77V148.75c0-5.4,4.38-9.77,9.77-9.77
			h16.3V83.35h-0.74c-5.39,0-9.77-4.38-9.77-9.77V43.51c0-5.4,4.38-9.77,9.77-9.77h63.03c5.4,0,9.77,4.37,9.77,9.77v30.07
			c0,5.39-4.37,9.77-9.77,9.77h-0.73v55.63h30.09V83.35h-0.73c-5.4,0-9.77-4.38-9.77-9.77V43.51c0-5.4,4.37-9.77,9.77-9.77h63.03
			c5.39,0,9.77,4.37,9.77,9.77v30.07c0,5.39-4.38,9.77-9.77,9.77h-0.74v55.63h30.1V83.35h-0.74c-5.39,0-9.77-4.38-9.77-9.77V43.51
			c0-5.4,4.38-9.77,9.77-9.77h63.03c5.4,0,9.77,4.37,9.77,9.77v30.07c0,5.39-4.37,9.77-9.77,9.77h-0.73v55.63h16.29
			C292.88,138.98,297.25,143.35,297.25,148.75z M277.71,244.22v-85.7h-6.52v40.54c0,16.98-13.81,30.78-30.78,30.78
			c-16.98,0-30.78-13.8-30.78-30.78v-40.54h-30.1v40.54c0,16.98-13.8,30.78-30.78,30.78c-16.97,0-30.78-13.8-30.78-30.78v-40.54
			H87.88v40.54c0,16.98-13.81,30.78-30.78,30.78s-30.78-13.8-30.78-30.78v-40.54h-6.53v85.7H277.71z M262.15,63.81V53.28h-43.49
			v10.53H262.15z M251.65,199.06v-72.25h-22.48v72.25c0,6.2,5.04,11.24,11.24,11.24C246.6,210.3,251.65,205.26,251.65,199.06z
			 M251.65,107.27V83.35h-22.48v23.92H251.65z M170.5,63.81V53.28h-43.49v10.53H170.5z M159.99,199.06v-72.25h-22.48v72.25
			c0,6.2,5.04,11.24,11.24,11.24S159.99,205.26,159.99,199.06z M159.99,107.27V83.35h-22.48v23.92H159.99z M78.84,63.81V53.28H35.35
			v10.53H78.84z M68.34,199.06v-72.25H45.86v72.25c0,6.2,5.04,11.24,11.24,11.24S68.34,205.26,68.34,199.06z M68.34,107.27V83.35
			H45.86v23.92H68.34z"/>
	</g>
	<g>
	</g>
</g>
</svg>
    `;

  let asset;
  let logoFormat = 'svg';

  if (logoDomain) {
    const url = `https://img.logo.dev/${logoDomain}?token=${process.env.LOGO_API_KEY}&format=png`;
    const realAssetResponse = await fetch(url);

    if (realAssetResponse.ok) {
      const arrayBuffer = await realAssetResponse.arrayBuffer();
      asset = Buffer.from(arrayBuffer);
      logoFormat = 'png';
    } else {
      asset = dummyAsset;
    }
  } else {
    asset = dummyAsset;
  }

  fs.writeFileSync(path.join(assetsPath, `${name}.${logoFormat}`), asset);
  return { logoFormat };
}

function runFormatter() {
  const p = execa('pnpm', ['prettier:format', '--cache']);
  p.stdout?.pipe(process.stdout);
}

export interface Source {
  name: string;
  logoDomain?: string;
  authType: string;
  openapiSpec: string;
  tokenUrl?: string;
  serverUrl?: string;
  authorizationUrl?: string;
  apiKeys?: string[];
  configKeys?: string[];
  idKey?: string;
  fallbackIdKey?: string;
  configIdKey?: string;
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
      };
}

export async function generate(source: Source) {
  const name = transformName(source.name);
  console.log(name);

  const openapiSpec = source.openapiSpec;

  let authEndpoint;
  let tokenEndpoint;

  switch (source.authType) {
    case 'API_KEY': {
      break;
    }

    case 'OAUTH': {
      const authorization_url = source.authorizationUrl;
      const token_url = source.tokenUrl;

      if (!authorization_url || !token_url) {
        console.error(`Skipping ${name} because it does not have an authorization URL or token URL`);
        return;
      }

      authEndpoint = authorization_url;
      tokenEndpoint = token_url;

      break;
    }

    default: {
      throw new Error('Invalid auth type');
    }
  }

  const { modulePath, srcPath } = bootstrapDir(name.toLowerCase());

  const spec = await getOpenApiSpec({ srcPath, openapiSpec });
  const securitySchemes = spec.components?.securitySchemes;
  const oauth2Key =
    securitySchemes?.['Oauth2c'] ||
    securitySchemes?.['OAuth2c'] ||
    securitySchemes?.['OAuth2'] ||
    securitySchemes?.['Oauth2'];

  const scopes = (oauth2Key?.flows?.implicit?.scopes || oauth2Key?.flows?.authorizationCode?.scopes) as
    | Record<string, string>
    | undefined;

  const { logoFormat } = await writeAssets({ srcPath, name: name.toLowerCase(), logoDomain: source.logoDomain });

  const integration = generateIntegration({
    name,
    authType: source.authType,
    apiKeys: source.apiKeys,
    logoFormat,
    // entities,
    // registeredEvents: events,
    configKeys: source?.configKeys,
    // eventHandlerImports,
    apiEndpoint: spec.servers?.[0]?.url || source.serverUrl,
    authorization: source.authorization,
    authEndpoint,
    tokenEndpoint,
    server: source.serverUrl,
    scopes,
  });

  const indexPath = path.join(srcPath, 'index.ts');
  fs.writeFileSync(indexPath, integration);

  // Write the test file
  fs.writeFileSync(
    path.join(srcPath, `${name}.test.ts`),
    createIntegrationTest({
      name: name.toLowerCase(),
      sentenceCasedName: name,
      configKeys: source?.configKeys,
      apiKeys: source?.apiKeys,
      authType: source.authType,
    }),
  );

  // Write test env file
  fs.writeFileSync(
    path.join(modulePath, '.env'),
    `
    CLIENT_ID=CLIENT_ID
    CLIENT_ID=CLIENT_ID
    DB_URL='postgresql://postgres:postgres@localhost:5432/kepler?schema=kepler'
    ${(source?.configKeys || [])?.map(key => `${key}=${key}`).join('\n')}
    ${(source?.apiKeys || [])?.map(key => `${key}=${key}`).join('\n')}
  `,
  );

  // Write jest config
  fs.writeFileSync(
    path.join(modulePath, 'jest.config.js'),
    createIntegrationJestConfig({
      modulePath,
    }),
  );

  // Write jest svg transformers
  fs.writeFileSync(
    path.join(modulePath, 'svgTransform.js'),
    createSvgTransformer({
      modulePath,
    }),
  );

  await runFormatter();
}
