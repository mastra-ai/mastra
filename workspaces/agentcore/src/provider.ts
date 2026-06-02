/**
 * AWS Bedrock AgentCore Runtime sandbox provider descriptor.
 *
 * Enables registration with MastraEditor for UI-driven sandbox configuration.
 */

import type { SandboxProvider } from '@mastra/core/editor';
import { AgentCoreRuntimeSandbox } from './sandbox';

export interface AgentCoreRuntimeProviderConfig {
  /** AWS region for the Bedrock AgentCore client */
  region?: string;
  /** AgentCore Runtime ARN where commands should execute */
  agentRuntimeArn: string;
  /** Runtime session ID */
  runtimeSessionId?: string;
  /** Agent runtime qualifier/endpoint */
  qualifier?: string;
  /** Default command timeout in milliseconds */
  commandTimeout?: number;
  /** Stop the runtime session during stop()/destroy() */
  stopSessionOnLifecycle?: boolean;
}

export const agentCoreRuntimeSandboxProvider: SandboxProvider<AgentCoreRuntimeProviderConfig> = {
  id: 'agentcore',
  name: 'AgentCore Runtime Sandbox',
  description: 'AWS Bedrock AgentCore Runtime command execution sandbox',
  configSchema: {
    type: 'object',
    required: ['agentRuntimeArn'],
    properties: {
      region: {
        type: 'string',
        description: 'AWS region for Bedrock AgentCore',
      },
      agentRuntimeArn: {
        type: 'string',
        description: 'AgentCore Runtime ARN',
      },
      runtimeSessionId: {
        type: 'string',
        description: 'Runtime session ID. Defaults to a generated UUID.',
      },
      qualifier: {
        type: 'string',
        description: 'Agent runtime qualifier/endpoint',
        default: 'DEFAULT',
      },
      commandTimeout: {
        type: 'number',
        description: 'Default command timeout in milliseconds. Must be between 1 and 3,600,000.',
        default: 300_000,
        minimum: 1,
        maximum: 3_600_000,
      },
      stopSessionOnLifecycle: {
        type: 'boolean',
        description: 'Stop the AgentCore Runtime session during stop()/destroy()',
        default: false,
      },
    },
  },
  createSandbox: config => new AgentCoreRuntimeSandbox(config),
};
