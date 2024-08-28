import { execa } from 'execa';
import fs from 'fs';
import path from 'path';
import { parse } from 'yaml';

import { sources } from './source';
import { createIntegration, createPackageJson, createTsConfig } from './template';

function getSchemas(openApiObject) {
  const schemas = openApiObject?.components?.schemas;

  if (schemas) {
    return schemas;
  }

  const responses = openApiObject?.components?.responses;

  if (responses) {
    return Object.entries(responses || {}).reduce((memo, [k, v]) => {
      if (v.content['application/json']?.schema) {
        memo[k] = v.content['application/json']?.schema;
      }
      return memo;
    }, {});
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

function buildSyncFunc({ name, paths, schemas }) {
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
          ?.map(p => {
            if (p?.name) {
              const typeToSchema = {
                string: 'z.string()',
                integer: 'z.number()',
                boolean: 'z.boolean()',
              };
              return `'${p.name}': ${typeToSchema[p.schema.type] || 'z.string()'}`;
            } else if (p?.$ref) {
              return `'${p.$ref.replace('#/components/parameters/', '')}': z.string()`;
            }
          })
          .filter(Boolean) || [];

      const totalZodParams = [...zodParams, ...apiParamsZod];

      const queryParams =
        params?.map(p => {
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
                schema: ${
                  totalZodParams?.length
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

function buildFieldDefs(schemas) {
  const typeToType = {
    string: `PropertyType.SINGLE_LINE_TEXT`,
  };

  function makeProps(properties: Record<string, any>) {
    const props = Object.entries(properties || {}).map(([k, p]) => {
      return `{
                name: '${k}',
                displayName: '${k}',
                order: 0,
                type: ${typeToType[p.type] || `PropertyType.SINGLE_LINE_TEXT`} ,
            }`;
    });

    if (props.length === 0) {
      return [];
    }

    return props;
  }

  function makeProperties({ s }) {
    let props: string[] = [];

    if (s.properties) {
      props = [...props, ...makeProps(s.properties)];
    } else if (s.allOf) {
      props = [...props, ...s.allOf.flatMap(s => makeProperties({ s }))];
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

    try {
      const openapispecRes = await fetch(openapi_url);
      let apiobj = await openapispecRes.text();
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

      funcMap.forEach(({ funcName, entityType, path: pathApi, queryParams, requestParams }) => {
        fs.writeFileSync(
          path.join(srcPath, 'events', `${funcName}.ts`),
          `
                    import { EventHandler } from '@arkw/core';
                    import { ${entityType}Fields } from '../constants';
                    import { ${name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()}Integration } from '..';

                    export const ${funcName}: EventHandler<${
            name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
          }Integration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getProxy },
  makeWebhookUrl,
}) => ({        
                        id: \`\${name}-sync-${entityType}\`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { ${queryParams.length ? queryParams?.join('') : ''} ${
            requestParams.length ? requestParams?.join('') : ``
          }  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getProxy({ referenceId })

                         
                            const response = await proxy['${pathApi}'].get({
                                ${queryParams?.length ? `query: {${queryParams?.join('')}},` : ''}
                                ${requestParams?.length ? `params: {${requestParams?.join('')}}` : ''} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

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

      fs.writeFileSync(
        path.join(srcPath, 'openapi.ts'),
        `
            export default ${openapi} as const
            `,
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
      name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
      server: serverEndpoint,
      authEndpoint: authUrl,
      tokenEndpoint,
      syncFuncs,
      syncFuncImports,
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

main();
