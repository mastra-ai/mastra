// import { execa } from 'execa';
import fs from 'fs';
import { omit } from 'lodash';
import path from 'path';
import { parse } from 'yaml';

import { sources } from './source';
import {
  createIntegration,
  createIntegrationJestConfig,
  createIntegrationTest,
  createPackageJson,
  createSvgTransformer,
  createTsConfig,
  createDtsConfig,
  generateIntegration,
  eventHandler,
} from './template';

function getSchemas(openApiObject: any) {
  const schemas = openApiObject?.components?.schemas;

  if (schemas) {
    return schemas;
  }

  const responses = openApiObject?.components?.responses as [any, any];

  if (responses) {
    return Object.entries(responses || {}).reduce((memo, [k, v]) => {
      if (v.content['application/json']?.schema) {
        memo[k] = v.content['application/json']?.schema;
      }
      return memo;
    }, {} as Record<string, any>);
  }
}

function extractParams(pattern: string, path: string): Record<string, string | undefined> {
  // Convert pattern to regular expression
  const regexPattern = pattern
    .replace(/{([^}]+)}/g, '([^/]+)') // Convert {param} to a capturing group
    .replace(/\//g, '\\/'); // Escape slashes

  const regex = new RegExp(`^${regexPattern}$`);
  const match = path.match(regex);

  if (!match) {
    return {};
  }

  // Extract parameter names from the pattern
  const paramNames = (pattern.match(/{([^}]+)}/g) || []).map(param => param.replace(/[{}]/g, ''));

  // Map matches to parameters
  const params: Record<string, string | undefined> = {};
  paramNames.forEach((name, index) => {
    params[name] = `string`;
  });

  return params;
}

function buildSyncFunc({ name, paths, schemas }: any) {
  const allGetMethods = Object.entries(paths)
    .filter(([path, methods]) => {
      return !!(methods as any).get;
    })
    .map(([path, methods]) => {
      return { path, method: (methods as any).get };
    });

  return allGetMethods
    .filter(Boolean)
    .filter(({ method, path }) => {
      const jsonContent = method?.responses?.['200']?.content?.['application/json'];
      const allContent = method?.responses?.['200']?.content?.['*/*'];
      const responseContent = { schema: { $ref: method?.responses?.['200']?.$ref } };
      const content = jsonContent || allContent || responseContent;

      return content?.schema?.properties?.data?.type === 'array' || content?.schema?.$ref;
    })
    ?.map(({ method, path }) => {
      const jsonContent = method?.responses?.['200']?.content?.['application/json'];
      const allContent = method?.responses?.['200']?.content?.['*/*'];
      const responseContent = { schema: { $ref: method?.responses?.['200']?.$ref } };
      const content = jsonContent || allContent || responseContent;

      const params = method?.parameters;

      const apiParams = extractParams(path, path);

      const apiParamsZod = Object.entries(apiParams || {}).map(([k, v]) => {
        return `${k}: z.string()`;
      });

      // console.log(apiParams, params)

      const zodParams =
        params
          ?.map((p: any) => {
            if (p?.name) {
              const typeToSchema = {
                string: 'z.string()',
                integer: 'z.number()',
                boolean: 'z.boolean()',
              };
              return `'${p.name}': ${typeToSchema[p.schema.type as keyof typeof typeToSchema] || 'z.string()'}`;
            } else if (p?.$ref) {
              return `'${p.$ref.replace('#/components/parameters/', '')}': z.string()`;
            }
          })
          .filter(Boolean) || [];

      const totalZodParams = [...zodParams, ...apiParamsZod];

      const queryParams =
        params?.map((p: any) => {
          if (p?.name) {
            return `${p.name},`;
          } else if (p?.$ref) {
            return `${p.$ref.replace('#/components/parameters/', '')},`;
          }
        }) || [];

      const requestParams = Object.entries(apiParams || {})?.map(([k]) => `${k},`);

      const entityType =
        content?.schema?.$ref?.replace('#/components/schemas/', '').replace('#/components/responses/', '') ||
        content?.schema?.properties?.data?.items?.$ref?.replace('#/components/schemas/', '');

      const operationId =
        method.operationId?.replace('get', '').replaceAll('/', '') ||
        content?.schema?.$ref?.replace('#/components/responses/', '')?.replace('#/components/schemas/', '') ||
        pathToFunctionName(path);

      return {
        path,
        entityType,
        queryParams,
        requestParams,
        eventDef: `
             '${name.toLowerCase()}.${operationId}/sync': {
                schema: ${totalZodParams?.length
            ? `z.object({
                  ${totalZodParams.join(',\n')}})`
            : `z.object({})`
          },
                handler: ${operationId},
            },
        `,
        funcName: operationId,
      };
    });
}

function buildFieldDefs(schemas: any) {
  const typeToType = {
    string: `PropertyType.SINGLE_LINE_TEXT`,
  };

  function makeProps(properties: Record<string, any>) {
    const props = Object.entries(properties || {}).map(([k, p]) => {
      return `{
                name: '${k}',
                displayName: '${k}',
                order: 0,
                type: ${typeToType[p.type as keyof typeof typeToType] || `PropertyType.SINGLE_LINE_TEXT`} ,
            }`;
    });

    if (props.length === 0) {
      return [];
    }

    return props;
  }

  function makeProperties({ s }: any) {
    let props: string[] = [];

    if (s.properties) {
      props = [...props, ...makeProps(s.properties)];
    } else if (s.allOf) {
      props = [...props, ...s.allOf.flatMap((s: any) => makeProperties({ s }))];
    } else if (s.$ref) {
      const refName = s.$ref.replace('#/components/schemas/', '');
      const newS = schemas[refName];
      props = [...props, ...makeProperties({ s: newS })];
    }

    return props;
  }

  return Object.entries(schemas)
    .map(([name, schema]) => {
      const props = makeProperties({ s: schema });

      return `
            export const ${name.replaceAll('--', '_').replaceAll('-', '_')}Fields = [${props.join(',\n')}];
            `;
    })
    .join('\n\n');
}

async function main() {
  for (const source of sources) {
    const name = source['Integration Name'];
    const sentenceCasedName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    // if (name !== 'webflow') {
    //   continue;
    // }
    const authorization_url = source['Authorization URL'];
    const token_url = source['Token URL'];
    const openapi_url = source['OpenAPI integration'];

    if (['admin', 'cli', 'core', 'google', 'mailchimp', 'rewatch', 'slack', 'twitter-v2'].includes(name)) {
      console.log(`Skipping ${name} because it is a reserved name`);
      continue;
    }

    if (!authorization_url) {
      console.log(`Skipping ${name} because it does not have an authorization URL`);
      continue;
    }

    const modulePath = path.join(process.cwd(), 'packages', name);

    if (!fs.existsSync(modulePath)) {
      fs.mkdirSync(modulePath);
    }

    // write package.json
    const pkgJsonPath = path.join(modulePath, 'package.json');
    fs.writeFileSync(pkgJsonPath, JSON.stringify(createPackageJson(name), null, 2));

    // write tsconfig
    const tsConfigPath = path.join(modulePath, 'tsconfig.json');
    fs.writeFileSync(tsConfigPath, JSON.stringify(createTsConfig(), null, 2));

    // dts.config.ts
    fs.writeFileSync(
      path.join(modulePath, 'dts.config.ts'),
      `
    import image from '@rollup/plugin-image';

    export default {
      rollup(config, options) {
        config.plugins.push(image());
        return config;
      },
    };
            `,
    );

    const srcPath = path.join(modulePath, 'src');

    if (!fs.existsSync(srcPath)) {
      fs.mkdirSync(srcPath);
    }

    let syncFuncs = '';
    let syncFuncImports = ``;
    let apiobj;

    try {
      const openapispecRes = await fetch(openapi_url);
      apiobj = await openapispecRes.text();
      let openapi = apiobj;

      if (openapi_url.endsWith('.yaml')) {
        apiobj = parse(apiobj);
        openapi = JSON.stringify(apiobj, null, 2);
      } else {
        apiobj = JSON.parse(apiobj);
      }

      const schemas = getSchemas(apiobj as any);

      const paths = (apiobj as any)?.paths || {};

      if (schemas) {
        const fieldDefs = buildFieldDefs(schemas);
        fs.writeFileSync(
          path.join(srcPath, 'constants.ts'),
          `
                    import { PropertyType } from '@arkw/core';
                    ${fieldDefs}
                    `,
        );
      }

      if (!fs.existsSync(path.join(srcPath, 'events'))) {
        fs.mkdirSync(path.join(srcPath, 'events'));
      } else {
        fs.rmSync(path.join(srcPath, 'events'), { recursive: true });
        fs.mkdirSync(path.join(srcPath, 'events'));
      }

      const funcMap = buildSyncFunc({ name, paths, schemas });

      syncFuncImports = funcMap.map(({ funcName }) => `import { ${funcName} } from './events/${funcName}'`).join('\n');

      // Write the event handler files
      funcMap.forEach(({ funcName, entityType, path: pathApi, queryParams, requestParams }) => {
        fs.writeFileSync(
          path.join(srcPath, 'events', `${funcName}.ts`),
          `
                    import { EventHandler } from '@arkw/core';
                    import { ${entityType}Fields } from '../constants';
                    import { ${name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()}Integration } from '..';

                    export const ${funcName}: EventHandler<${name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
          }Integration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: \`\${name}-sync-${entityType}-${funcName}\`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { ${queryParams.length ? queryParams?.join('') : ''} ${requestParams.length ? requestParams?.join('') : ``
          }  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['${pathApi}'].get({
                                ${queryParams?.length
            ? `query: {${queryParams
              .map((qp: string) => {
                const value = qp.split('_query_param')[0]; // doing a split here to correctly format query params
                if (value === qp) return value;
                return `${value}:${qp}`;
              })
              ?.join('')}},`
            : ''
          }
                                ${requestParams?.length ? `params: {${requestParams?.join('')}}` : ''} })

                            if (!response.ok) {
                              const error = await response.json();
                              console.log("error in fetching ${funcName}", JSON.stringify(error, null, 2));
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: \`${entityType}\`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: \`${entityType}\`,
                                properties: ${entityType}Fields,
                            });
                        },
                })
                `,
        );
      });

      syncFuncs = `this.events = {${funcMap.map(({ eventDef }) => eventDef).join('\n')}}`;

      // Write the openapi file
      fs.writeFileSync(
        path.join(srcPath, 'openapi.ts'),
        `
            export default ${openapi} as const
            `,
      );

      // Write the test file
      fs.writeFileSync(
        path.join(srcPath, `${name}.test.ts`),
        createIntegrationTest({
          name,
          sentenceCasedName,
        }),
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
    } catch (e) {
      console.error(`Failed to fetch OpenAPI spec for ${name}`, e);
      continue;
    }

    const indexPath = path.join(srcPath, 'index.ts');

    const server = new URL(authorization_url);
    const authUrl = getPathFromUrl(authorization_url);
    const tokenEndpoint = getPathFromUrl(token_url);

    const serverEndpoint = `${server.protocol}//${server.host}`.replace('connectionconfig', 'this.config');

    const int = createIntegration({
      name: sentenceCasedName,
      server: serverEndpoint,
      authEndpoint: authUrl,
      tokenEndpoint,
      syncFuncs,
      syncFuncImports,
      apiEndpoint: apiobj.servers[0].url,
    });

    fs.writeFileSync(indexPath, int);
  }

  // const p = execa('pnpm', ['prettier:format']);

  // p.stdout?.pipe(process.stdout);
}

function getPathFromUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.pathname;
  } catch (error) {
    console.error('Invalid URL:', error);
    return '';
  }
}

function pathToFunctionName(path: string): string {
  // Remove leading and trailing slashes
  const cleanedPath = path.replace(/^\/|\/$/g, '');

  // Replace dynamic parameters enclosed in curly braces with their names
  const parameterizedPath = cleanedPath.replace(/{([^}]+)}/g, '$1');

  // Split the path into segments by '/'
  const segments = parameterizedPath.split('/');

  // Convert segments to camelCase
  const camelCaseSegments = segments.map((segment, index) => {
    // Capitalize first letter of each segment except the first one
    const formattedSegment = index === 0 ? segment.toLowerCase() : segment.charAt(0).toUpperCase() + segment.slice(1);
    return formattedSegment;
  });

  // Join segments into a single camelCase string
  return camelCaseSegments.join('');
}

function transformName(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
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

  return srcPath;
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
    path.join(srcPath, 'openapi.ts'),
    `
    // @ts-nocheck
    export default ${JSON.stringify(trimmedSpec, null, 2)} as const`,
  );

  return trimmedSpec;
}

function formatPropertyName(name: string) {
  return name.replaceAll(/[\W_.]/g, '_').toUpperCase();
}

function getEntityNames(spec: any) {
  const schemas = spec.components.schemas;
  if (!schemas) {
    return;
  }

  const names: Record<string, string> = {};

  Object.entries(schemas).forEach(([name, schema]: [string, any]) => {
    if (schema.type === `string`) {
      return;
    }

    if (schema.properties) {
      names[formatPropertyName(name)] = formatPropertyName(name);
    }
  });

  return names;
}

function writeEntityProperties({ srcPath, spec }: { srcPath: string; spec: any }) {
  const typeToType: Record<string, string> = {
    string: `PropertyType.SINGLE_LINE_TEXT`,
  };

  const schemas = spec.components.schemas;
  if (!schemas) {
    return;
  }

  const props = Object.entries(schemas)
    .map(([name, schema]: [string, any]) => {
      if (schema.type === `string`) {
        return;
      }

      if (schema.properties) {
        return {
          name: formatPropertyName(name),
          properties: Object.entries(schema.properties).map(([k, p]: [string, any]) => {
            return {
              name: k,
              displayName: k,
              order: 0,
              type: typeToType[p.type] || `PropertyType.SINGLE_LINE_TEXT`,
            };
          }),
        };
      }
    })
    .filter(Boolean);

  if (props.length === 0) {
    return;
  }

  const exports = props
    .map(prop => {
      if (!prop) {
        return;
      }
      const propertyString = prop.properties
        .map(({ name, displayName, order, type }) => {
          return `
        {
          name: '${name}',
          displayName: '${displayName}',
          order: ${order},
          type: ${type},
        },
      `;
        })
        .join('\n');

      return `
      export const ${prop.name}Fields = [${propertyString}]
    `;
    })
    .join('\n');

  fs.writeFileSync(
    path.join(srcPath, 'constants.ts'),
    `
    import { PropertyType } from '@arkw/core';
    ${exports}
    `,
  );
}

function bootstrapEventsDir(srcPath: string) {
  const eventsPath = path.join(srcPath, 'events');

  if (!fs.existsSync(eventsPath)) {
    fs.mkdirSync(eventsPath);
  } else {
    fs.rmSync(eventsPath, { recursive: true });
    fs.mkdirSync(eventsPath);
  }

  return eventsPath;
}

function bootstrapAssetsDir(srcPath: string) {
  const eventsPath = path.join(srcPath, 'assets');

  if (!fs.existsSync(eventsPath)) {
    fs.mkdirSync(eventsPath);
  }

  return eventsPath;
}

function getMethodsFromSpec({ spec, method }: { spec: any; method: string }) {
  return Object.entries(spec.paths)
    .filter(([_path, methods]: [string, any]) => {
      return !!methods?.[method];
    })
    .map(([path, methods]: [string, any]) => {
      return [path, methods?.[method]];
    });
}

function parametersToZod({ parameters }: { parameters: any[] }) {
  const typeToZod: Record<string, string> = {
    string: `z.string()`,
    integer: `z.number()`,
    boolean: `z.boolean()`,
  };

  return parameters?.reduce((memo, currentVal) => {
    memo[currentVal.name] = typeToZod[currentVal?.schema?.type] || `z.string()`;
    return memo;
  }, {} as Record<string, string>);
}

function getOperationsFromSpec({ spec, method }: { spec: any, method: string }) {
  const methods = getMethodsFromSpec({ spec, method });

  return methods.map(([_path, method]) => {
    return method.operationId;
  })
}

function getOperationDef({ spec, opId }: { spec: any; opId: string }) {
  const paths = spec.paths;

  const operation = Object.entries(paths).find(([path, methods]: [string, any]) => {

    const d = Object.entries(methods)?.find(([method, methodObj]: [string, any]) => {
      return methodObj.operationId === opId;
    })
    return d
  })

  const op = operation?.[1] as Record<string, any>;

  return { op: op?.['get'] || op?.['post'], apiPath: operation?.[0] };
}

function getSchemaFromSpec({ spec, schemaPath }: { spec: any; schemaPath: string }) {
  const sPath = schemaPath.replace('#/components/schemas/', '');
  return spec.components.schemas[sPath];
}

function assembleRegisterEvents({ spec, name }: { name: string; spec: any }) {
  if (!spec.paths) {
    return;
  }

  // For registering sync events, we only care about GET requests
  const methods = getMethodsFromSpec({ spec, method: `get` });

  return methods
    .map(([_path, method]) => {
      const paramsToZod = parametersToZod({ parameters: method.parameters });

      let schema = `z.object({})`;

      if (paramsToZod) {
        schema = `z.object({${Object.entries(paramsToZod)
          .map(([k, v]) => {
            return `'${k}': ${v}`;
          })
          .join(',\n')}})`;
      }

      return `
    ${`'${name}.${method.operationId}/sync'`}: {
      label: '${method.operationId}',
      description: '${method.description}',
      schema: ${schema},
      handler: ${method.operationId},
    },
    `;
    })
    .join('\n');
}

function writeAssets({ name, srcPath }: { name: string, srcPath: string }) {
  const assetsPath = bootstrapAssetsDir(srcPath);

  fs.writeFileSync(path.join(assetsPath, `${name}.svg`), `
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
    `)
}

interface Source {
  name: string;
  authType: string;
  openapiSpec: string;
  tokenUrl?: string;
  authorizationUrl?: string;
  configKeys?: string[]
  idKey: string,
  fallbackIdKey: string
}

export async function generate(source: Source) {
  const name = transformName(source.name);
  console.log(name);

  const openapiSpec = source.openapiSpec;

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

      break;
    }

    default: {
      throw new Error('Invalid auth type');
    }
  }

  const srcPath = bootstrapDir(name.toLowerCase());

  const spec = await getOpenApiSpec({ srcPath, openapiSpec });

  const entities = getEntityNames(spec);

  // console.log(entities)

  writeEntityProperties({ srcPath, spec });

  const eventsPath = bootstrapEventsDir(srcPath);
  writeAssets({ srcPath, name: name.toLowerCase() });

  const events = assembleRegisterEvents({ name: name.toLowerCase(), spec });

  const eventHandlerOperations = getOperationsFromSpec({ spec, method: 'get' })

  eventHandlerOperations.forEach((opId) => {
    const { op, apiPath } = getOperationDef({ spec, opId });
    const schema = op.responses?.['200']?.content?.['application/json']?.schema;

    let entityType
    let returnType
    let idKey
    // Find the $ref
    if (schema?.['$ref']) {
      const sPath = schema['$ref'].replace('#/components/schemas/', '');
      entityType = formatPropertyName(sPath)
      const s = getSchemaFromSpec({ spec, schemaPath: schema['$ref'] });
      console.log(s)
      returnType = s.type

      // does this object have our idKey
      if (s.properties[source.idKey]) {
        idKey = source.idKey
      } else if (s.properties[source.fallbackIdKey]) {
        idKey = source.fallbackIdKey
      }

      // console.log(schema['$ref'], s)
    }

    if (!entityType || !apiPath || !returnType || !idKey) {
      return
    }

    
    const queryParams = op.parameters?.filter((p: any) => p.in === 'query').map((p: any) => `${p.name}`)
    const pathParams = op.parameters?.filter((p: any) => p.in === 'path').map((p: any) => `${p.name}`)

    fs.writeFileSync(path.join(eventsPath, `${opId}.ts`), eventHandler({ entityType, name, opId, queryParams, pathParams, apiPath, returnType, idKey }))
  })

  const eventHandlerImports = eventHandlerOperations.map((opId) => {
    return `import { ${opId} } from './events/${opId}';`
  }).join('\n');

  const integration = generateIntegration({ name, authType: source.authType, entities, registeredEvents: events, configKeys: source?.configKeys, eventHandlerImports });
  const indexPath = path.join(srcPath, 'index.ts');
  fs.writeFileSync(indexPath, integration);
}
