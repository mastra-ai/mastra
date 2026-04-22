import type { IAgentBuilder } from '@mastra/core/agent-builder/ee';
import type { IMastraEditor } from '@mastra/core/editor';
import { describe, it, expect, vi } from 'vitest';

import { GET_EDITOR_BUILDER_SETTINGS_ROUTE } from './editor-builder';

// Minimal mock mastra for handler testing
const createMockMastra = (editor?: Partial<IMastraEditor>) =>
  ({
    getEditor: () => editor,
  }) as any;

describe('GET /editor/builder/settings', () => {
  it('returns enabled: false when no editor configured', async () => {
    const mastra = createMockMastra();
    const result = await GET_EDITOR_BUILDER_SETTINGS_ROUTE.handler({ mastra } as any);

    expect(result).toEqual({ enabled: false });
  });

  it('returns enabled: false when editor lacks resolveBuilder', async () => {
    const mastra = createMockMastra({});
    const result = await GET_EDITOR_BUILDER_SETTINGS_ROUTE.handler({ mastra } as any);

    expect(result).toEqual({ enabled: false });
  });

  it('returns enabled: false when hasEnabledBuilderConfig returns false', async () => {
    const mastra = createMockMastra({
      hasEnabledBuilderConfig: () => false,
      resolveBuilder: vi.fn(),
    });
    const result = await GET_EDITOR_BUILDER_SETTINGS_ROUTE.handler({ mastra } as any);

    expect(result).toEqual({ enabled: false });
  });

  it('returns enabled: false when resolveBuilder returns undefined', async () => {
    const mastra = createMockMastra({
      hasEnabledBuilderConfig: () => true,
      resolveBuilder: vi.fn().mockResolvedValue(undefined),
    });
    const result = await GET_EDITOR_BUILDER_SETTINGS_ROUTE.handler({ mastra } as any);

    expect(result).toEqual({ enabled: false });
  });

  it('returns builder settings when builder is enabled', async () => {
    const mockBuilder: IAgentBuilder = {
      enabled: true,
      getFeatures: () => ({ agent: { tools: true, memory: true } }),
      getConfiguration: () => ({ agent: { maxTokens: 4096 } }),
    };
    const mastra = createMockMastra({
      hasEnabledBuilderConfig: () => true,
      resolveBuilder: vi.fn().mockResolvedValue(mockBuilder),
    });
    const result = await GET_EDITOR_BUILDER_SETTINGS_ROUTE.handler({ mastra } as any);

    expect(result).toEqual({
      enabled: true,
      features: { agent: { tools: true, memory: true } },
      configuration: { agent: { maxTokens: 4096 } },
    });
  });

  it('returns enabled: false when builder.enabled is false', async () => {
    const mockBuilder: IAgentBuilder = {
      enabled: false,
      getFeatures: () => ({}),
      getConfiguration: () => ({}),
    };
    const mastra = createMockMastra({
      hasEnabledBuilderConfig: () => true,
      resolveBuilder: vi.fn().mockResolvedValue(mockBuilder),
    });
    const result = await GET_EDITOR_BUILDER_SETTINGS_ROUTE.handler({ mastra } as any);

    expect(result).toEqual({
      enabled: false,
      features: {},
      configuration: {},
    });
  });

  it('throws HTTPException when resolveBuilder throws', async () => {
    const mastra = createMockMastra({
      hasEnabledBuilderConfig: () => true,
      resolveBuilder: vi.fn().mockRejectedValue(new Error('License check failed')),
    });

    await expect(GET_EDITOR_BUILDER_SETTINGS_ROUTE.handler({ mastra } as any)).rejects.toThrow('License check failed');
  });
});

describe('GET /editor/builder/settings route metadata', () => {
  it('has correct path and method', () => {
    expect(GET_EDITOR_BUILDER_SETTINGS_ROUTE.path).toBe('/editor/builder/settings');
    expect(GET_EDITOR_BUILDER_SETTINGS_ROUTE.method).toBe('GET');
  });

  it('requires agents:read permission', () => {
    expect(GET_EDITOR_BUILDER_SETTINGS_ROUTE.requiresPermission).toBe('agents:read');
  });

  it('requires authentication', () => {
    expect(GET_EDITOR_BUILDER_SETTINGS_ROUTE.requiresAuth).toBe(true);
  });
});
