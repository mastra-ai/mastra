/**
 * Boat sandbox provider descriptor for MastraEditor.
 */

import type { SandboxProvider } from '@mastra/core/editor';
import { BoatSandbox } from './sandbox';
import type { BoatSandboxOptions } from './sandbox';

export type BoatProviderConfig = Pick<
  BoatSandboxOptions,
  | 'id'
  | 'apiKey'
  | 'baseUrl'
  | 'sandboxId'
  | 'machineType'
  | 'ttlSeconds'
  | 'env'
  | 'noEnv'
  | 'environment'
  | 'setupScript'
  | 'org'
  | 'checkpointName'
  | 'seedCheckpointName'
  | 'workingDirectory'
  | 'timeout'
  | 'publicPorts'
>;

export const boatSandboxProvider: SandboxProvider<BoatProviderConfig> = {
  id: 'boat',
  name: 'Boat Sandbox',
  description: 'Boat cloud Linux VM sandbox with preview URLs, snapshots and forks',
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      id: {
        type: 'string',
        description: 'Stable sandbox ID for this instance.',
      },
      apiKey: {
        type: 'string',
        description: 'Boat API key. Falls back to the BOAT_API_KEY environment variable.',
      },
      baseUrl: {
        type: 'string',
        description: 'Boat API base URL. Falls back to BOAT_BASE_URL.',
        default: 'https://boat.dev/api/v1',
      },
      sandboxId: {
        type: 'string',
        description: 'Reattach to an existing Boat sandbox by its Boat id (bx_…) instead of creating one.',
      },
      machineType: {
        type: 'string',
        enum: ['small', 'default', 'large', 'xlarge'],
        description: 'Machine size. small bills at half rate, large at double, xlarge higher still.',
        default: 'default',
      },
      ttlSeconds: {
        type: ['number', 'null'],
        description:
          'Seconds before Boat archives the sandbox automatically. Omit for Boat’s one-hour default; null disables auto-stop.',
      },
      env: {
        type: 'object',
        description: 'Environment variables injected into the sandbox and every command.',
        additionalProperties: { type: 'string' },
      },
      noEnv: {
        type: 'boolean',
        description:
          'Create the sandbox with none of the account’s secrets attached, for sandboxes given to end users.',
        default: false,
      },
      environment: {
        type: 'string',
        description: 'Name of the Boat environment (repositories, secrets, credentials) to attach.',
      },
      setupScript: {
        type: 'string',
        description: 'Script run in the background once at creation. Max 64KB.',
      },
      org: {
        type: 'string',
        description: 'Organization wallet to bill this sandbox to.',
      },
      checkpointName: {
        type: 'string',
        description: 'Named Boat snapshot this sandbox saves to on snapshot() and boots from on start().',
      },
      seedCheckpointName: {
        type: 'string',
        description: 'Named snapshot used to seed a new sandbox when checkpointName has nothing saved yet.',
      },
      workingDirectory: {
        type: 'string',
        description: 'Default directory for commands and process spawns.',
        default: '/home/user',
      },
      timeout: {
        type: 'number',
        description: 'Default command timeout in milliseconds. Omit to let commands run until they exit.',
      },
      publicPorts: {
        type: 'boolean',
        description: 'Expose hosted ports without Boat’s _token query parameter.',
        default: false,
      },
    },
  },
  createSandbox: config => new BoatSandbox(config),
};
