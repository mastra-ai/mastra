import { describe, expectTypeOf, it } from 'vitest';
import type {
  AuthFlowStatus,
  AuthorizeOpts,
  Connection,
  ListToolServicesResult,
  ListToolsOpts,
  ListToolsResult,
  ResolveToolsOpts,
  ToolIntegration,
  ToolIntegrationCapabilities,
  ToolIntegrationConfig,
  ToolIntegrationHealth,
  ToolIntegrations,
  ToolMeta,
} from './tool-integration';

describe('ToolIntegration — type contracts', () => {
  it('Connection.label is a required string', () => {
    expectTypeOf<Connection['label']>().toEqualTypeOf<string>();
  });

  it('Connection.kind enumerates the three modes (only `author` written in v1)', () => {
    expectTypeOf<Connection['kind']>().toEqualTypeOf<'author' | 'invoker' | 'platform'>();
  });

  it('Connection denormalizes toolService and exposes opaque connectionId', () => {
    expectTypeOf<Connection['toolService']>().toEqualTypeOf<string>();
    expectTypeOf<Connection['connectionId']>().toEqualTypeOf<string>();
  });

  it('ToolIntegrationConfig.tools is keyed by tool slug → ToolMeta', () => {
    expectTypeOf<ToolIntegrationConfig['tools']>().toEqualTypeOf<Record<string, ToolMeta>>();
  });

  it('ToolIntegrationConfig.connections is keyed by toolService → Connection[]', () => {
    expectTypeOf<ToolIntegrationConfig['connections']>().toEqualTypeOf<Record<string, Connection[]>>();
  });

  it('ToolIntegrations is keyed by integrationId → ToolIntegrationConfig', () => {
    expectTypeOf<ToolIntegrations>().toEqualTypeOf<Record<string, ToolIntegrationConfig>>();
  });

  it('ToolIntegration exposes a readonly literal id surface', () => {
    type IdField = ToolIntegration['id'];
    expectTypeOf<IdField>().toEqualTypeOf<string>();
    type CapsField = ToolIntegration['capabilities'];
    expectTypeOf<CapsField>().toEqualTypeOf<ToolIntegrationCapabilities>();
  });

  it('listToolServices returns a wrapped ListToolServicesResult', () => {
    expectTypeOf<ReturnType<ToolIntegration['listToolServices']>>().toEqualTypeOf<Promise<ListToolServicesResult>>();
  });

  it('listTools takes an optional ListToolsOpts and returns ListToolsResult', () => {
    expectTypeOf<Parameters<ToolIntegration['listTools']>>().toEqualTypeOf<[ListToolsOpts?]>();
    expectTypeOf<ReturnType<ToolIntegration['listTools']>>().toEqualTypeOf<Promise<ListToolsResult>>();
  });

  it('resolveTools takes ResolveToolsOpts', () => {
    expectTypeOf<Parameters<ToolIntegration['resolveTools']>[0]>().toEqualTypeOf<ResolveToolsOpts>();
  });

  it('authorize takes AuthorizeOpts and returns { url, authId }', () => {
    expectTypeOf<Parameters<ToolIntegration['authorize']>[0]>().toEqualTypeOf<AuthorizeOpts>();
    expectTypeOf<ReturnType<ToolIntegration['authorize']>>().toEqualTypeOf<Promise<{ url: string; authId: string }>>();
  });

  it('getAuthStatus returns AuthFlowStatus', () => {
    expectTypeOf<ReturnType<ToolIntegration['getAuthStatus']>>().toEqualTypeOf<Promise<AuthFlowStatus>>();
  });

  it('getConnectionStatus is batched (array input, record output keyed by connectionId)', () => {
    type Opts = Parameters<ToolIntegration['getConnectionStatus']>[0];
    expectTypeOf<Opts>().toEqualTypeOf<{
      items: Array<{ connectionId: string; toolService: string }>;
    }>();
    expectTypeOf<ReturnType<ToolIntegration['getConnectionStatus']>>().toEqualTypeOf<
      Promise<Record<string, { connected: boolean }>>
    >();
  });

  it('getHealth returns ToolIntegrationHealth', () => {
    expectTypeOf<ReturnType<ToolIntegration['getHealth']>>().toEqualTypeOf<Promise<ToolIntegrationHealth>>();
  });
});
