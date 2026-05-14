import { describe, it, expect } from 'vitest';
import { BaseToolIntegration, DuplicateIntegrationError, UnknownIntegrationError } from '@mastra/core/tool-integration';
import type {
  AuthFlowStatus,
  AuthorizeOpts,
  ResolveToolsOpts,
  ToolDescriptor,
  ToolIntegrationCapabilities,
  ToolService,
} from '@mastra/core/tool-integration';
import { MastraEditor } from './index';

class StubIntegration extends BaseToolIntegration {
  readonly id: string;
  readonly displayName: string;
  readonly capabilities: ToolIntegrationCapabilities = {
    multipleConnectionsPerService: true,
    batchConnectionStatus: true,
    reauthorizeReusesConnectionId: true,
  };

  constructor(id: string, displayName = id) {
    super();
    this.id = id;
    this.displayName = displayName;
  }

  protected async fetchToolServices(): Promise<ToolService[]> {
    return [];
  }
  protected async fetchTools(): Promise<ToolDescriptor[]> {
    return [];
  }
  async resolveTools(_opts: ResolveToolsOpts) {
    return {};
  }
  async authorize(_opts: AuthorizeOpts) {
    return { url: 'about:blank', authId: 'a' };
  }
  async getAuthStatus(_authId: string): Promise<AuthFlowStatus> {
    return 'pending';
  }
  async getConnectionStatus(_opts: { items: Array<{ connectionId: string; toolService: string }> }) {
    return {};
  }
}

describe('MastraEditor tool integration registry', () => {
  it('returns empty list when no integrations are registered', () => {
    const editor = new MastraEditor();
    expect(editor.getToolIntegrations()).toEqual([]);
    expect(editor.getToolIntegration('anything')).toBeUndefined();
  });

  it('exposes registered integrations via getToolIntegrations and getToolIntegration', () => {
    const composio = new StubIntegration('composio');
    const other = new StubIntegration('other');
    const editor = new MastraEditor({ toolIntegrations: [composio, other] });

    expect(editor.getToolIntegrations()).toEqual([composio, other]);
    expect(editor.getToolIntegration('composio')).toBe(composio);
    expect(editor.getToolIntegration('other')).toBe(other);
    expect(editor.getToolIntegration('missing')).toBeUndefined();
  });

  it('throws UnknownIntegrationError from getToolIntegrationOrThrow when id is unknown', () => {
    const editor = new MastraEditor({ toolIntegrations: [new StubIntegration('composio')] });
    expect(() => editor.getToolIntegrationOrThrow('missing')).toThrowError(UnknownIntegrationError);
  });

  it('returns the integration from getToolIntegrationOrThrow when id is known', () => {
    const composio = new StubIntegration('composio');
    const editor = new MastraEditor({ toolIntegrations: [composio] });
    expect(editor.getToolIntegrationOrThrow('composio')).toBe(composio);
  });

  it('throws DuplicateIntegrationError when two integrations share an id', () => {
    const a = new StubIntegration('composio');
    const b = new StubIntegration('composio');
    expect(() => new MastraEditor({ toolIntegrations: [a, b] })).toThrowError(DuplicateIntegrationError);
  });

  it('legacy toolProviders registry still works alongside toolIntegrations', () => {
    const composio = new StubIntegration('composio');
    const editor = new MastraEditor({
      toolIntegrations: [composio],
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      toolProviders: {},
    });
    expect(editor.getToolIntegration('composio')).toBe(composio);
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect(editor.getToolProviders()).toEqual({});
  });
});
