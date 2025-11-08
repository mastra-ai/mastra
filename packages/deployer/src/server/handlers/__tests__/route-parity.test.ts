import { describe, it, beforeAll, vi } from 'vitest';
import { Mastra } from '@mastra/core/mastra';
import { Hono } from 'hono';
import { SERVER_ROUTES, type ServerRoute } from '@mastra/server/server-adapter';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { CompositeVoice } from '@mastra/core/voice';
import { MockMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { openAPISpecs } from 'hono-openapi';
import { agentsRouter } from '../routes/agents/router';
import { workflowsRouter } from '../routes/workflows/router';
import { toolsRouter } from '../routes/tools/router';
import { memoryRoutes } from '../routes/memory/router';
import { scoresRouter } from '../routes/scores/router';
import { logsRouter } from '../routes/logs/router';
import { vectorRouter } from '../routes/vector/router';
import { observabilityRouter } from '../routes/observability/router';
import { agentBuilderRouter } from '../routes/agent-builder/router';

interface RouteInfo {
  method: string;
  path: string;
}

// Helper to convert Hono path format (:param) to OpenAPI format ({param})
function honoPathToOpenAPI(path: string): string {
  return path.replace(/:(\w+)/g, '{$1}');
}

describe('Deployer Routes → Server Adapter Parity', () => {
  let mastra: Mastra;
  let deployerApp: Hono;
  let uniqueDeployerRoutes: RouteInfo[];
  let serverRoutes: RouteInfo[];
  let serverRoutesMap: Map<string, ServerRoute>;
  let deployerOpenAPISpec: any;

  beforeAll(async () => {
    vi.clearAllMocks();

    // Create minimal test setup
    const testTool = createTool({
      id: 'test-tool',
      description: 'A test tool',
      inputSchema: z.object({ key: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      execute: async () => ({ result: 'success' }),
    });

    const mockVoice = new CompositeVoice({});
    vi.spyOn(mockVoice, 'getSpeakers').mockResolvedValue([]);
    vi.spyOn(mockVoice, 'getListener').mockResolvedValue({ enabled: false } as any);

    const storage = new InMemoryStore();
    const mockMemory = new MockMemory({ storage });

    const mockModel = {
      modelId: 'mock-model',
      provider: 'mock',
    };

    const testAgent = new Agent({
      name: 'test-agent',
      description: 'A test agent',
      instructions: 'Test instructions',
      model: mockModel as any,
      tools: { 'test-tool': testTool },
      voice: mockVoice,
      memory: mockMemory,
    });

    mastra = new Mastra({
      agents: { 'test-agent': testAgent },
    });

    // Create deployer app with ALL old routes
    deployerApp = new Hono();
    deployerApp.use('*', async (c, next) => {
      c.set('mastra', mastra);
      await next();
    });

    const bodyLimitOptions = {
      maxSize: 50 * 1024 * 1024,
      onError: (c: any) => c.json({ error: 'Request too large' }, 413),
    };

    // Register all deployer routes
    deployerApp.route('/api/agents', agentsRouter(bodyLimitOptions));
    deployerApp.route('/api/workflows', workflowsRouter(bodyLimitOptions));
    deployerApp.route('/api/tools', toolsRouter(bodyLimitOptions, { 'test-tool': testTool }));
    deployerApp.route('/api/memory', memoryRoutes(bodyLimitOptions));
    deployerApp.route('/api/scores', scoresRouter(bodyLimitOptions));
    deployerApp.route('/api/logs', logsRouter());
    deployerApp.route('/api/vector', vectorRouter(bodyLimitOptions));
    deployerApp.route('/api/observability', observabilityRouter());
    deployerApp.route('/api/agent-builder', agentBuilderRouter(bodyLimitOptions));

    // Extract unique deployer routes (deduplicate by method + path)
    const deployerRoutesMap = new Map<string, RouteInfo>();
    deployerApp.routes.forEach(r => {
      const key = `${r.method} ${r.path}`;
      if (!deployerRoutesMap.has(key)) {
        deployerRoutesMap.set(key, { method: r.method, path: r.path });
      }
    });
    uniqueDeployerRoutes = Array.from(deployerRoutesMap.values());

    // Extract server-adapter routes
    serverRoutes = SERVER_ROUTES.map(r => ({
      method: r.method,
      path: r.path,
    }));

    // Create a map for easy lookup of full ServerRoute objects
    serverRoutesMap = new Map();
    SERVER_ROUTES.forEach(r => {
      serverRoutesMap.set(`${r.method} ${r.path}`, r);
    });

    // Extract OpenAPI spec from deployer app
    const openAPIHandler = openAPISpecs(deployerApp, {
      documentation: {
        info: { title: 'Deployer API', version: '1.0.0' },
      },
    });

    // Call the handler to get the OpenAPI spec
    const mockContext = {
      json: (data: any) => data,
    } as any;

    deployerOpenAPISpec = await openAPIHandler(mockContext);
  });

  describe('1. Route Coverage: Deployer routes not in Server-Adapter', () => {
    it('should not have routes that exist only in deployer', () => {
      const failures: string[] = [];

      uniqueDeployerRoutes.forEach(route => {
        const exactMatch = serverRoutes.find(sr => sr.method === route.method && sr.path === route.path);
        // Only report if there's no exact match AND no path-only match (handled separately)
        const pathMatch = serverRoutes.find(sr => sr.path === route.path);

        if (!exactMatch && !pathMatch) {
          failures.push(`${route.method} ${route.path}`);
        }
      });

      if (failures.length > 0) {
        const errorMessage = `\nFound ${failures.length} deployer routes with no equivalent in server-adapter:\n${failures.map(r => `  - ${r}`).join('\n')}\n\nEach route must be added to server-adapter or documented as deprecated.`;
        throw new Error(errorMessage);
      }
    });
  });

  describe('2. Route Coverage: Server-Adapter routes not in Deployer', () => {
    it('should not have routes that exist only in server-adapter', () => {
      const failures: string[] = [];

      serverRoutes.forEach(route => {
        const exactMatch = uniqueDeployerRoutes.find(dr => dr.method === route.method && dr.path === route.path);
        // Only report if there's no exact match AND no path-only match (handled separately)
        const pathMatch = uniqueDeployerRoutes.find(dr => dr.path === route.path);

        if (!exactMatch && !pathMatch) {
          failures.push(`${route.method} ${route.path}`);
        }
      });

      if (failures.length > 0) {
        const errorMessage = `\nFound ${failures.length} server-adapter routes with no equivalent in deployer:\n${failures.map(r => `  - ${r}`).join('\n')}\n\nDocument as new feature or add to deployer.`;
        throw new Error(errorMessage);
      }
    });
  });

  describe('3. Route Coverage: HTTP Method Mismatches', () => {
    it('should not have routes with same path but different HTTP methods', () => {
      const failures: Array<{ deployer: string; serverAdapter: string; path: string }> = [];

      uniqueDeployerRoutes.forEach(deployerRoute => {
        const pathMatches = serverRoutes.filter(sr => sr.path === deployerRoute.path);

        pathMatches.forEach(serverRoute => {
          if (serverRoute.method !== deployerRoute.method) {
            failures.push({
              deployer: `${deployerRoute.method} ${deployerRoute.path}`,
              serverAdapter: `${serverRoute.method} ${serverRoute.path}`,
              path: deployerRoute.path,
            });
          }
        });
      });

      if (failures.length > 0) {
        const errorMessage = `\nFound ${failures.length} routes with HTTP method mismatches:\n${failures.map(f => `  Path: ${f.path}\n    Deployer:       ${f.deployer}\n    Server-Adapter: ${f.serverAdapter}`).join('\n\n')}\n\nHTTP methods must match between deployer and server-adapter.`;
        throw new Error(errorMessage);
      }
    });
  });

  describe('4. Schema Parity: Response Types', () => {
    it('all routes should have valid response types', () => {
      const failures: string[] = [];

      uniqueDeployerRoutes.forEach(route => {
        const serverRoute = serverRoutesMap.get(`${route.method} ${route.path}`);
        if (!serverRoute) return; // Skip routes not in server-adapter

        if (!['json', 'stream'].includes(serverRoute.responseType)) {
          failures.push(`${route.method} ${route.path} (invalid: ${serverRoute.responseType})`);
        }
      });

      if (failures.length > 0) {
        const errorMessage = `\nFound ${failures.length} routes with invalid response types:\n${failures.map(r => `  - ${r}`).join('\n')}`;
        throw new Error(errorMessage);
      }
    });
  });

  describe('5. OpenAPI Documentation', () => {
    it('all routes should have complete OpenAPI metadata', () => {
      const missingSummary: string[] = [];
      const missingDescription: string[] = [];
      const missingTags: string[] = [];

      SERVER_ROUTES.forEach(route => {
        const routeKey = `${route.method} ${route.path}`;

        if (!route.openapi?.summary) {
          missingSummary.push(routeKey);
        }
        if (!route.openapi?.description) {
          missingDescription.push(routeKey);
        }
        if (!route.openapi?.tags || route.openapi?.tags.length === 0) {
          missingTags.push(routeKey);
        }
      });

      const errors: string[] = [];
      if (missingSummary.length > 0) {
        errors.push(
          `Missing OpenAPI summary (${missingSummary.length}):\n${missingSummary.map(r => `  - ${r}`).join('\n')}`,
        );
      }
      if (missingDescription.length > 0) {
        errors.push(
          `Missing OpenAPI description (${missingDescription.length}):\n${missingDescription.map(r => `  - ${r}`).join('\n')}`,
        );
      }
      if (missingTags.length > 0) {
        errors.push(`Missing OpenAPI tags (${missingTags.length}):\n${missingTags.map(r => `  - ${r}`).join('\n')}`);
      }

      if (errors.length > 0) {
        throw new Error(`\n${errors.join('\n\n')}`);
      }
    });
  });

  describe('6. Schema Parity: Path Parameters', () => {
    it('overlapping routes should have matching path parameter schemas', () => {
      const failures: Array<{ route: string; issue: string }> = [];

      uniqueDeployerRoutes.forEach(route => {
        const serverRoute = serverRoutesMap.get(`${route.method} ${route.path}`);
        if (!serverRoute) return; // Skip routes not in server-adapter

        const openAPIPath = honoPathToOpenAPI(route.path);
        const deployerPathSpec = deployerOpenAPISpec.paths?.[openAPIPath]?.[route.method.toLowerCase()];

        if (!deployerPathSpec) return; // Skip if no OpenAPI spec

        const deployerParams = deployerPathSpec.parameters?.filter((p: any) => p.in === 'path') || [];
        const deployerParamNames = new Set(deployerParams.map((p: any) => p.name));
        const hasServerPathSchema = !!serverRoute.pathParamSchema;

        // If deployer has path params, server-adapter must too
        if (deployerParams.length > 0 && !hasServerPathSchema) {
          const paramNames = deployerParams.map((p: any) => p.name).join(', ');
          failures.push({
            route: `${route.method} ${route.path}`,
            issue: `Deployer has path params [${paramNames}], server-adapter has none`,
          });
          return;
        }

        // If server-adapter has path params, deployer must too
        if (hasServerPathSchema && deployerParams.length === 0) {
          failures.push({
            route: `${route.method} ${route.path}`,
            issue: `Server-adapter has path params, deployer has none`,
          });
          return;
        }

        // If both have path params, compare field names
        if (hasServerPathSchema && deployerParams.length > 0) {
          const serverSchema = serverRoute.pathParamSchema as any;
          const serverParamNames = new Set(Object.keys(serverSchema.shape || {}));

          // Check for missing params in server-adapter
          const missingInServer = Array.from(deployerParamNames).filter(name => !serverParamNames.has(name));
          if (missingInServer.length > 0) {
            failures.push({
              route: `${route.method} ${route.path}`,
              issue: `Path params in deployer but not server-adapter: [${missingInServer.join(', ')}]`,
            });
          }

          // Check for extra params in server-adapter
          const extraInServer = Array.from(serverParamNames).filter(name => !deployerParamNames.has(name));
          if (extraInServer.length > 0) {
            failures.push({
              route: `${route.method} ${route.path}`,
              issue: `Path params in server-adapter but not deployer: [${extraInServer.join(', ')}]`,
            });
          }
        }
      });

      if (failures.length > 0) {
        const errorMessage = `\nFound ${failures.length} routes with path parameter mismatches:\n${failures.map(f => `  ${f.route}\n    ${f.issue}`).join('\n')}`;
        throw new Error(errorMessage);
      }
    });
  });

  describe('7. Schema Parity: Query Parameters', () => {
    it('overlapping routes should have matching query parameter schemas', () => {
      const failures: Array<{ route: string; issue: string }> = [];

      uniqueDeployerRoutes.forEach(route => {
        const serverRoute = serverRoutesMap.get(`${route.method} ${route.path}`);
        if (!serverRoute) return;

        const openAPIPath = honoPathToOpenAPI(route.path);
        const deployerPathSpec = deployerOpenAPISpec.paths?.[openAPIPath]?.[route.method.toLowerCase()];

        if (!deployerPathSpec) return;

        const deployerQueryParams = deployerPathSpec.parameters?.filter((p: any) => p.in === 'query') || [];
        const deployerParamMap = new Map(
          deployerQueryParams.map((p: any) => [p.name, { required: p.required || false }]),
        );
        const hasServerQuerySchema = !!serverRoute.queryParamSchema;

        // If deployer has query params, server-adapter must too
        if (deployerQueryParams.length > 0 && !hasServerQuerySchema) {
          const paramNames = deployerQueryParams
            .map((p: any) => `${p.name}${p.required ? ' (required)' : ''}`)
            .join(', ');
          failures.push({
            route: `${route.method} ${route.path}`,
            issue: `Deployer has query params [${paramNames}], server-adapter has none`,
          });
          return;
        }

        // If server-adapter has query params, deployer must too
        if (hasServerQuerySchema && deployerQueryParams.length === 0) {
          failures.push({
            route: `${route.method} ${route.path}`,
            issue: `Server-adapter has query params, deployer has none`,
          });
          return;
        }

        // If both have query params, compare field names and required status
        if (hasServerQuerySchema && deployerQueryParams.length > 0) {
          const serverSchema = serverRoute.queryParamSchema as any;
          const serverShape = serverSchema.shape || {};
          const serverParamNames = new Set(Object.keys(serverShape));

          // Check for missing params in server-adapter
          const missingInServer: string[] = [];
          deployerParamMap.forEach((_, name) => {
            if (!serverParamNames.has(name)) {
              missingInServer.push(name);
            }
          });
          if (missingInServer.length > 0) {
            failures.push({
              route: `${route.method} ${route.path}`,
              issue: `Query params in deployer but not server-adapter: [${missingInServer.join(', ')}]`,
            });
          }

          // Check for extra params in server-adapter
          const extraInServer = Array.from(serverParamNames).filter(name => !deployerParamMap.has(name));
          if (extraInServer.length > 0) {
            failures.push({
              route: `${route.method} ${route.path}`,
              issue: `Query params in server-adapter but not deployer: [${extraInServer.join(', ')}]`,
            });
          }
        }
      });

      if (failures.length > 0) {
        const errorMessage = `\nFound ${failures.length} routes with query parameter mismatches:\n${failures.map(f => `  ${f.route}\n    ${f.issue}`).join('\n')}`;
        throw new Error(errorMessage);
      }
    });
  });

  describe('8. Schema Parity: Request Body', () => {
    it('overlapping routes should have matching request body schemas', () => {
      const failures: Array<{ route: string; issue: string }> = [];

      uniqueDeployerRoutes.forEach(route => {
        const serverRoute = serverRoutesMap.get(`${route.method} ${route.path}`);
        if (!serverRoute) return;

        const openAPIPath = honoPathToOpenAPI(route.path);
        const deployerPathSpec = deployerOpenAPISpec.paths?.[openAPIPath]?.[route.method.toLowerCase()];

        if (!deployerPathSpec) return;

        const deployerBodySchema = deployerPathSpec.requestBody?.content?.['application/json']?.schema;
        const hasDeployerBody = !!deployerBodySchema;
        const hasServerBody = !!serverRoute.bodySchema;

        // If deployer has request body, server-adapter must too
        if (hasDeployerBody && !hasServerBody) {
          const requiredFields = deployerBodySchema.required || [];
          const bodyProps = Object.keys(deployerBodySchema.properties || {});
          const details =
            bodyProps.length > 0
              ? `fields: [${bodyProps.join(', ')}], required: [${requiredFields.join(', ')}]`
              : 'schema defined';
          failures.push({
            route: `${route.method} ${route.path}`,
            issue: `Deployer has request body (${details}), server-adapter has none`,
          });
          return;
        }

        // If server-adapter has request body, deployer must too
        if (hasServerBody && !hasDeployerBody) {
          failures.push({
            route: `${route.method} ${route.path}`,
            issue: `Server-adapter has request body schema, deployer has none`,
          });
          return;
        }

        // If both have request body, compare field names
        if (hasDeployerBody && hasServerBody) {
          const deployerProps = new Set(Object.keys(deployerBodySchema.properties || {}));

          const serverSchema = serverRoute.bodySchema as any;
          const serverShape = serverSchema.shape || {};
          const serverProps = new Set(Object.keys(serverShape));

          // Check for missing fields in server-adapter
          const missingInServer = Array.from(deployerProps).filter(field => !serverProps.has(field));
          if (missingInServer.length > 0) {
            failures.push({
              route: `${route.method} ${route.path}`,
              issue: `Body fields in deployer but not server-adapter: [${missingInServer.join(', ')}]`,
            });
          }

          // Check for extra fields in server-adapter
          const extraInServer = Array.from(serverProps).filter(field => !deployerProps.has(field));
          if (extraInServer.length > 0) {
            failures.push({
              route: `${route.method} ${route.path}`,
              issue: `Body fields in server-adapter but not deployer: [${extraInServer.join(', ')}]`,
            });
          }
        }
      });

      if (failures.length > 0) {
        const errorMessage = `\nFound ${failures.length} routes with request body schema mismatches:\n${failures.map(f => `  ${f.route}\n    ${f.issue}`).join('\n')}`;
        throw new Error(errorMessage);
      }
    });
  });

  describe('9. Schema Parity: Required vs Optional Status', () => {
    it('overlapping routes should have matching required/optional status for query params and body fields', () => {
      const failures: Array<{ route: string; issue: string }> = [];

      uniqueDeployerRoutes.forEach(route => {
        const serverRoute = serverRoutesMap.get(`${route.method} ${route.path}`);
        if (!serverRoute) return;

        const openAPIPath = honoPathToOpenAPI(route.path);
        const deployerPathSpec = deployerOpenAPISpec.paths?.[openAPIPath]?.[route.method.toLowerCase()];

        if (!deployerPathSpec) return;

        // Check query parameter required status
        const deployerQueryParams = deployerPathSpec.parameters?.filter((p: any) => p.in === 'query') || [];
        if (deployerQueryParams.length > 0 && serverRoute.queryParamSchema) {
          const serverSchema = serverRoute.queryParamSchema as any;
          const serverShape = serverSchema.shape || {};

          for (const deployerParam of deployerQueryParams) {
            const paramName = deployerParam.name;
            const serverField = serverShape[paramName];

            if (serverField) {
              const deployerRequired = deployerParam.required || false;
              const serverRequired = !serverField.isOptional?.();

              if (deployerRequired !== serverRequired) {
                failures.push({
                  route: `${route.method} ${route.path}`,
                  issue: `Query param '${paramName}' required mismatch: deployer=${deployerRequired}, server-adapter=${serverRequired}`,
                });
              }
            }
          }
        }

        // Check request body field required status
        const deployerBodySchema = deployerPathSpec.requestBody?.content?.['application/json']?.schema;
        if (deployerBodySchema && serverRoute.bodySchema) {
          const deployerRequired = new Set(deployerBodySchema.required || []);
          const deployerProps = Object.keys(deployerBodySchema.properties || {});

          const serverSchema = serverRoute.bodySchema as any;
          const serverShape = serverSchema.shape || {};

          for (const field of deployerProps) {
            const serverField = serverShape[field];

            if (serverField) {
              const deployerIsRequired = deployerRequired.has(field);
              const serverIsRequired = !serverField.isOptional?.();

              if (deployerIsRequired !== serverIsRequired) {
                failures.push({
                  route: `${route.method} ${route.path}`,
                  issue: `Body field '${field}' required mismatch: deployer=${deployerIsRequired}, server-adapter=${serverIsRequired}`,
                });
              }
            }
          }
        }
      });

      if (failures.length > 0) {
        const errorMessage = `\nFound ${failures.length} routes with required/optional mismatches:\n${failures.map(f => `  ${f.route}\n    ${f.issue}`).join('\n')}`;
        throw new Error(errorMessage);
      }
    });
  });
});
