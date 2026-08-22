import type { FilesystemProvider, SandboxProvider } from '@mastra/core/editor';
import type { PlatformFilesystemOptions } from './filesystem.js';
import { PlatformFilesystem } from './filesystem.js';
import type { PlatformSandboxOptions } from './sandbox.js';
import { PlatformSandbox } from './sandbox.js';

const nonEmptyStringSchema = { type: 'string', minLength: 1, maxLength: 32 * 1024 } as const;
const stringOrStringsSchema = {
  oneOf: [nonEmptyStringSchema, { type: 'array', items: nonEmptyStringSchema, minItems: 1, maxItems: 512 }],
} as const;
const envsSchema = {
  type: 'object',
  propertyNames: nonEmptyStringSchema,
  additionalProperties: { type: 'string', maxLength: 32 * 1024 },
  maxProperties: 512,
} as const;
const booleanOptionsSchema = (properties: Record<string, { type: 'boolean' }>) => ({
  type: 'object',
  properties,
  additionalProperties: false,
});
const aptInstallOptionsSchema = booleanOptionsSchema({
  noInstallRecommends: { type: 'boolean' },
  fixMissing: { type: 'boolean' },
});
const pipInstallOptionsSchema = booleanOptionsSchema({ g: { type: 'boolean' } });
const npmInstallOptionsSchema = booleanOptionsSchema({ g: { type: 'boolean' }, dev: { type: 'boolean' } });
const operationSchema = {
  oneOf: [
    {
      type: 'object',
      properties: {
        method: { const: 'runCmd' },
        args: { type: 'array', prefixItems: [stringOrStringsSchema], minItems: 1, maxItems: 1 },
      },
      required: ['method', 'args'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        method: { const: 'setWorkdir' },
        args: { type: 'array', prefixItems: [nonEmptyStringSchema], minItems: 1, maxItems: 1 },
      },
      required: ['method', 'args'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        method: { const: 'setEnvs' },
        args: { type: 'array', prefixItems: [envsSchema], minItems: 1, maxItems: 1 },
      },
      required: ['method', 'args'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        method: { const: 'aptInstall' },
        args: {
          type: 'array',
          prefixItems: [stringOrStringsSchema, aptInstallOptionsSchema],
          minItems: 1,
          maxItems: 2,
        },
      },
      required: ['method', 'args'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        method: { const: 'pipInstall' },
        args: {
          oneOf: [
            { type: 'array', maxItems: 0 },
            { type: 'array', prefixItems: [stringOrStringsSchema], minItems: 1, maxItems: 1 },
            {
              type: 'array',
              prefixItems: [{ oneOf: [stringOrStringsSchema, { type: 'null' }] }, pipInstallOptionsSchema],
              minItems: 2,
              maxItems: 2,
            },
          ],
        },
      },
      required: ['method', 'args'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        method: { const: 'npmInstall' },
        args: {
          oneOf: [
            { type: 'array', maxItems: 0 },
            { type: 'array', prefixItems: [stringOrStringsSchema], minItems: 1, maxItems: 1 },
            {
              type: 'array',
              prefixItems: [{ oneOf: [stringOrStringsSchema, { type: 'null' }] }, npmInstallOptionsSchema],
              minItems: 2,
              maxItems: 2,
            },
          ],
        },
      },
      required: ['method', 'args'],
      additionalProperties: false,
    },
  ],
} as const;

export const platformSandboxProvider: SandboxProvider<PlatformSandboxOptions> = {
  id: 'platform',
  name: 'Mastra Platform Sandbox',
  description: 'Environment-scoped sandbox execution through Mastra Platform workspace proxy',
  configSchema: {
    type: 'object',
    properties: {
      accessToken: {
        type: 'string',
        description: 'Mastra Platform access token (falls back to MASTRA_PLATFORM_ACCESS_TOKEN)',
      },
      projectId: { type: 'string', description: 'Platform project ID (falls back to MASTRA_PROJECT_ID)' },
      actingUserId: { type: 'string', description: 'Opaque user subject attributed to sandbox requests' },
      sandboxProvider: {
        type: 'string',
        description: 'Sandbox provider (falls back to SANDBOX_PROVIDER, then railway)',
        enum: ['railway', 'e2b'],
      },
      environmentId: { type: 'string', description: 'Platform environment ID (falls back to MASTRA_ENVIRONMENT_ID)' },
      sandboxId: { type: 'string', description: 'Reattach to an existing Platform sandbox by ID' },
      template: {
        type: 'object',
        description: 'Serialized non-secret template definition built before sandbox creation',
        properties: {
          schemaVersion: { const: 1 },
          operations: {
            type: 'array',
            items: operationSchema,
            maxItems: 256,
          },
        },
        required: ['schemaVersion', 'operations'],
        additionalProperties: false,
      },
      idleTimeoutMinutes: { type: 'number', description: 'Minutes before the sandbox can be destroyed while idle' },
      networkIsolation: {
        type: 'string',
        description: 'Network isolation mode',
        enum: ['ISOLATED', 'PRIVATE'],
        default: 'ISOLATED',
      },
      env: { type: 'object', description: 'Environment variables', additionalProperties: { type: 'string' } },
      timeout: { type: 'number', description: 'Default command timeout in ms' },
    },
  },
  createSandbox: config => new PlatformSandbox(config),
};

export const platformFilesystemProvider: FilesystemProvider<PlatformFilesystemOptions> = {
  id: 'platform',
  name: 'Mastra Platform Filesystem',
  description: 'Bucket-backed filesystem access through Mastra Platform workspace proxy',
  configSchema: {
    type: 'object',
    properties: {
      accessToken: {
        type: 'string',
        description: 'Mastra Platform access token (falls back to MASTRA_PLATFORM_ACCESS_TOKEN)',
      },
      projectId: { type: 'string', description: 'Platform project ID (falls back to MASTRA_PROJECT_ID)' },
      bucketName: {
        type: 'string',
        description: 'Platform workspace bucket name (falls back to MASTRA_PLATFORM_BUCKET_NAME)',
      },
      readOnly: { type: 'boolean', description: 'Mount as read-only', default: false },
    },
  },
  createFilesystem: config => new PlatformFilesystem(config),
};
