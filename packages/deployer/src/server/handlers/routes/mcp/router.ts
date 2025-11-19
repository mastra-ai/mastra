import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { describeRoute } from 'hono-openapi';
import type { BodyLimitOptions } from '../../../types';
import {
  getMcpServerMessageHandler,
  getMcpServerSseHandler,
  listMcpRegistryServersHandler,
  getMcpRegistryServerDetailHandler,
  listMcpServerToolsHandler,
  getMcpServerToolDetailHandler,
  executeMcpServerToolHandler,
} from './handlers';

export function mcpRouter(bodyLimitOptions: BodyLimitOptions) {
  const router = new Hono();

  router.post(
    '/:serverId/mcp',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Send a message to an MCP server using Streamable HTTP',
      tags: ['mcp'],
      parameters: [
        {
          name: 'serverId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        content: { 'application/json': { schema: { type: 'object' } } },
      },
      responses: {
        200: {
          description: 'Streamable HTTP connection processed',
        },
        404: {
          description: 'MCP server not found',
        },
      },
    }),
    getMcpServerMessageHandler,
  );

  router.get(
    '/:serverId/mcp',
    describeRoute({
      description: 'Send a message to an MCP server using Streamable HTTP',
      tags: ['mcp'],
      parameters: [
        {
          name: 'serverId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Streamable HTTP connection processed',
        },
        404: {
          description: 'MCP server not found',
        },
      },
    }),
    getMcpServerMessageHandler,
  );

  // New MCP server routes for SSE
  const mcpSseBasePath = '/:serverId/sse';
  const mcpSseMessagePath = '/:serverId/messages';

  // Route for establishing SSE connection
  router.get(
    mcpSseBasePath,
    describeRoute({
      description: 'Establish an MCP Server-Sent Events (SSE) connection with a server instance.',
      tags: ['mcp'],
      parameters: [
        {
          name: 'serverId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'The ID of the MCP server instance.',
        },
      ],
      responses: {
        200: {
          description:
            'SSE connection established. The client will receive events over this connection. (Content-Type: text/event-stream)',
        },
        404: { description: 'MCP server instance not found.' },
        500: { description: 'Internal server error establishing SSE connection.' },
      },
    }),
    getMcpServerSseHandler,
  );

  // Route for POSTing messages over an established SSE connection
  router.post(
    mcpSseMessagePath,
    bodyLimit(bodyLimitOptions), // Apply body limit for messages
    describeRoute({
      description: 'Send a message to an MCP server over an established SSE connection.',
      tags: ['mcp'],
      parameters: [
        {
          name: 'serverId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'The ID of the MCP server instance.',
        },
      ],
      requestBody: {
        description: 'JSON-RPC message to send to the MCP server.',
        required: true,
        content: { 'application/json': { schema: { type: 'object' } } }, // MCP messages are typically JSON
      },
      responses: {
        200: {
          description:
            'Message received and is being processed by the MCP server. The actual result or error will be sent as an SSE event over the established connection.',
        },
        400: { description: 'Bad request (e.g., invalid JSON payload or missing body).' },
        404: { description: 'MCP server instance not found or SSE connection path incorrect.' },
        503: { description: 'SSE connection not established with this server, or server unable to process message.' },
      },
    }),
    getMcpServerSseHandler,
  );

  router.get(
    '/v0/servers',
    describeRoute({
      description: 'List all available MCP server instances with basic information.',
      tags: ['mcp'],
      parameters: [
        {
          name: 'limit',
          in: 'query',
          description: 'Number of results per page.',
          required: false,
          schema: { type: 'integer', default: 50, minimum: 1, maximum: 5000 },
        },
        {
          name: 'offset',
          in: 'query',
          description: 'Number of results to skip for pagination.',
          required: false,
          schema: { type: 'integer', default: 0, minimum: 0 },
        },
      ],
      responses: {
        200: {
          description: 'A list of MCP server instances.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  servers: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        repository: {
                          type: 'object',
                          properties: {
                            url: { type: 'string', description: 'The URL of the repository (e.g., a GitHub URL)' },
                            source: {
                              type: 'string',
                              description: "The source control platform (e.g., 'github', 'gitlab')",
                              enum: ['github', 'gitlab'],
                            },
                            id: { type: 'string', description: 'A unique identifier for the repository at the source' },
                          },
                        },
                        version_detail: {
                          type: 'object',
                          properties: {
                            version: { type: 'string', description: 'The semantic version string (e.g., "1.0.2")' },
                            release_date: {
                              type: 'string',
                              description: 'The ISO 8601 date-time string when this version was released or registered',
                            },
                            is_latest: {
                              type: 'boolean',
                              description: 'Indicates if this version is the latest available',
                            },
                          },
                        },
                      },
                    },
                  },
                  next: { type: 'string', format: 'uri', nullable: true },
                  total_count: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    }),
    listMcpRegistryServersHandler,
  );

  router.get(
    '/v0/servers/:id',
    describeRoute({
      description: 'Get detailed information about a specific MCP server instance.',
      tags: ['mcp'],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'Unique ID of the MCP server instance.',
          schema: { type: 'string' },
        },
        {
          name: 'version',
          in: 'query',
          required: false,
          description: 'Desired MCP server version (currently informational, server returns its actual version).',
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Detailed information about the MCP server instance.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  repository: {
                    type: 'object',
                    properties: {
                      url: { type: 'string' },
                      source: { type: 'string' },
                      id: { type: 'string' },
                    },
                  },
                  version_detail: {
                    type: 'object',
                    properties: {
                      version: { type: 'string' },
                      release_date: { type: 'string' },
                      is_latest: { type: 'boolean' },
                    },
                  },
                  package_canonical: { type: 'string' },
                  packages: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        registry_name: { type: 'string' },
                        name: { type: 'string' },
                        version: { type: 'string' },
                        command: {
                          type: 'object',
                          properties: {
                            name: { type: 'string' },
                            subcommands: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  name: { type: 'string' },
                                  description: { type: 'string' },
                                  is_required: { type: 'boolean' },
                                  subcommands: {
                                    type: 'array',
                                    items: { type: 'object' },
                                  },
                                  positional_arguments: {
                                    type: 'array',
                                    items: { type: 'object' },
                                  },
                                  named_arguments: {
                                    type: 'array',
                                    items: { type: 'object' },
                                  },
                                },
                              },
                            },
                            positional_arguments: {
                              type: 'array',
                              items: { type: 'object' },
                            },
                            named_arguments: {
                              type: 'array',
                              items: { type: 'object' },
                            },
                          },
                        },
                        environment_variables: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              name: { type: 'string' },
                              description: { type: 'string' },
                              required: { type: 'boolean' },
                              default_value: { type: 'string' },
                            },
                          },
                        },
                      },
                    },
                  },
                  remotes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        transport_type: { type: 'string' },
                        url: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        404: {
          description: 'MCP server instance not found.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' },
                },
              },
            },
          },
        },
      },
    }),
    getMcpRegistryServerDetailHandler,
  );

  router.get(
    '/:serverId/tools',
    describeRoute({
      description: 'List all tools available on a specific MCP server instance.',
      tags: ['mcp'],
      parameters: [
        {
          name: 'serverId',
          in: 'path',
          required: true,
          description: 'Unique ID of the MCP server instance.',
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: { description: 'A list of tools for the MCP server.' }, // Define schema if you have one for McpServerToolListResponse
        404: { description: 'MCP server instance not found.' },
        501: { description: 'Server does not support listing tools.' },
      },
    }),
    listMcpServerToolsHandler,
  );

  router.get(
    '/:serverId/tools/:toolId',
    describeRoute({
      description: 'Get details for a specific tool on an MCP server.',
      tags: ['mcp'],
      parameters: [
        { name: 'serverId', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'toolId', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        200: { description: 'Details of the specified tool.' }, // Define schema for McpToolInfo
        404: { description: 'MCP server or tool not found.' },
        501: { description: 'Server does not support getting tool details.' },
      },
    }),
    getMcpServerToolDetailHandler,
  );

  router.post(
    '/:serverId/tools/:toolId/execute',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Execute a specific tool on an MCP server.',
      tags: ['mcp'],
      parameters: [
        { name: 'serverId', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'toolId', in: 'path', required: true, schema: { type: 'string' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                data: { type: 'object' },
                requestContext: { type: 'object' },
              },
            },
          },
        }, // Simplified schema
      },
      responses: {
        200: { description: 'Result of the tool execution.' },
        400: { description: 'Invalid tool arguments.' },
        404: { description: 'MCP server or tool not found.' },
        501: { description: 'Server does not support tool execution.' },
      },
    }),
    executeMcpServerToolHandler,
  );

  return router;
}
