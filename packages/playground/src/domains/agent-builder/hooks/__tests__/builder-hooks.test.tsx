// @vitest-environment jsdom
import type { BuilderAvailableModelsResponse } from '@mastra/client-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { StrictMode } from 'react';
import type { PropsWithChildren } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getBuilderSettings,
  getBuilderAvailableModels,
  hasAnyPermission,
  hasPermission,
  useStoredAgentMutations,
  useStoredAgentDependents,
  useCreateSkill,
  useUpdateSkill,
  useDefaultVisibility,
  toast,
  permissionState,
  llmProvidersState,
  navigateSpy,
} = vi.hoisted(() => ({
  getBuilderSettings: vi.fn(async () => {
    const response = await fetch('http://localhost/api/builder/settings');
    if (!response.ok) throw new Error('Failed to load builder settings');
    return response.json();
  }),
  getBuilderAvailableModels: vi.fn(async (): Promise<BuilderAvailableModelsResponse> => ({ providers: [] })),
  hasAnyPermission: vi.fn(),
  hasPermission: vi.fn(),
  useStoredAgentMutations: vi.fn(),
  useStoredAgentDependents: vi.fn(),
  useCreateSkill: vi.fn(),
  useUpdateSkill: vi.fn(),
  useDefaultVisibility: vi.fn(() => 'private'),
  toast: { success: vi.fn(), error: vi.fn() },
  permissionState: { rbacEnabled: false },
  llmProvidersState: { data: undefined as any, isLoading: false },
  navigateSpy: vi.fn(),
}));

vi.mock('react-router', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useNavigate: () => navigateSpy };
});

vi.mock('@mastra/react', () => ({
  useMastraClient: () => ({ getBuilderSettings, getBuilderAvailableModels }),
}));

vi.mock('@mastra/client-js', async importOriginal => {
  const actual = await importOriginal();
  return { ...(actual as object), createTool: (config: unknown) => config };
});

vi.mock('@mastra/playground-ui', () => {
  const base = {
    toast,
    cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
    Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    Dialog: ({ children, open, onOpenChange }: any) => (
      <div data-open={open} onClick={() => onOpenChange?.(false)}>
        {children}
      </div>
    ),
    DialogBody: ({ children }: any) => <div>{children}</div>,
    DialogContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    DialogDescription: ({ children }: any) => <p>{children}</p>,
    DialogFooter: ({ children }: any) => <div>{children}</div>,
    DialogHeader: ({ children }: any) => <div>{children}</div>,
    DialogTitle: ({ children }: any) => <h2>{children}</h2>,
    GoogleIcon: () => <div />,
    AmazonIcon: () => <div />,
    AnthropicChatIcon: () => <div />,
    AnthropicMessagesIcon: () => <div />,
    AzureIcon: () => <div />,
    CohereIcon: () => <div />,
    GroqIcon: () => <div />,
    MastraIcon: () => <div />,
    MistralIcon: () => <div />,
    NetlifyIcon: () => <div />,
    OpenaiChatIcon: () => <div />,
    XGroqIcon: () => <div />,
  };
  return base;
});

vi.mock('@/domains/auth/hooks/use-permissions', () => ({
  usePermissions: () => ({ hasAnyPermission, hasPermission, rbacEnabled: permissionState.rbacEnabled }),
}));

vi.mock('@/domains/auth/hooks/use-default-visibility', () => ({ useDefaultVisibility }));
vi.mock('@/domains/agents/hooks/use-stored-agents', () => ({ useStoredAgentMutations, useStoredAgentDependents }));
vi.mock('@/domains/agents/hooks/use-create-skill', () => ({ useCreateSkill }));
vi.mock('@/domains/agents/hooks/use-update-skill', () => ({ useUpdateSkill }));
vi.mock('@/domains/llm', () => ({
  useLLMProviders: () => llmProvidersState,
  useAllModels: (providers: any[]) =>
    providers.flatMap(provider => provider.models.map((model: string) => ({ provider: provider.id, model }))),
  cleanProviderId: (provider: string) => provider.split(':')[0],
}));

import { useAgentBuilderAllowedModels } from '../use-agent-builder-allowed-models';
import { useAgentBuilderTool } from '../use-agent-builder-tool';
import { useAutoScroll } from '../use-auto-scroll';
import { useAutosaveAgent } from '../use-autosave-agent';
import { useAutosaveSkill } from '../use-autosave-skill';
import { useAvailableAgentTools } from '../use-available-agent-tools';
import { useBuilderAgentAccess } from '../use-builder-agent-access';
import { useBuilderAgentFeatures } from '../use-builder-agent-features';
import { useCanCreateAgent } from '../use-can-create-agent';
import { useChannelConnectToast } from '../use-channel-connect-toast';
import { useChatDraft } from '../use-chat-draft';
import { useCreateSkillTool } from '../use-create-skill-tool';
import { useSaveAgent } from '../use-save-agent';
import { useStarterUserMessage } from '../use-starter-user-message';
import { useVisibilityChange as useAgentVisibilityChange } from '../use-visibility-change-agent';
import { useVisibilityChange as useSkillVisibilityChange } from '../use-visibility-change-skill';
import {
  useBuilderModelPolicy,
  useBuilderPickerVisibility,
  useBuilderSettings,
  useIsBuilderEnabled,
} from '@/domains/agent-builder/hooks/use-builder-settings';

const builderSettings = {
  enabled: true,
  features: {
    agent: {
      tools: true,
      memory: true,
      workflows: true,
      agents: true,
      avatarUpload: true,
      skills: true,
      model: true,
      favorites: true,
      browser: true,
    },
  },
  modelPolicy: {
    active: true,
    allowed: [{ provider: 'openai', modelId: 'gpt-4o' }],
    default: { provider: 'openai', modelId: 'gpt-4o' },
  },
  picker: {
    visibleTools: ['tool-a', 'tool-b'],
    visibleAgents: ['agent-a'],
    visibleWorkflows: ['workflow-a', 'workflow-b'],
  },
};

const server = setupServer(http.get('http://localhost/api/builder/settings', () => HttpResponse.json(builderSettings)));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const createFormWrapper = (defaultValues: Record<string, unknown> = {}) => {
  return ({ children }: PropsWithChildren) => {
    const methods = useForm({ defaultValues });
    return <FormProvider {...methods}>{children}</FormProvider>;
  };
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  server.resetHandlers();
  getBuilderSettings.mockClear();
});

afterAll(() => server.close());

beforeEach(() => {
  getBuilderSettings.mockClear();
  vi.clearAllMocks();
  getBuilderAvailableModels.mockResolvedValue({ providers: [] });
  permissionState.rbacEnabled = false;
  hasAnyPermission.mockReturnValue(true);
  hasPermission.mockReturnValue(true);
  useDefaultVisibility.mockReturnValue('private');
  useStoredAgentMutations.mockReturnValue({
    updateStoredAgent: { mutateAsync: vi.fn().mockResolvedValue({ id: 'agent-id' }), isPending: false },
  });
  useStoredAgentDependents.mockReturnValue({ isLoading: false });
  useCreateSkill.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({ id: 'skill-new' }), isPending: false });
  useUpdateSkill.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({ id: 'skill-id' }), isPending: false });
  llmProvidersState.data = undefined;
  llmProvidersState.isLoading = false;
});

describe('useAgentBuilderAllowedModels', () => {
  it('returns the providers and flat models from the available-models endpoint', async () => {
    getBuilderAvailableModels.mockResolvedValue({
      providers: [{ id: 'openai', name: 'openai', envVar: 'OPENAI_API_KEY', connected: true, models: ['gpt-4o'] }],
    });

    const { result } = renderHook(() => useAgentBuilderAllowedModels(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.providers).toHaveLength(1));
    expect(getBuilderAvailableModels).toHaveBeenCalledTimes(1);
    expect(result.current.providers).toEqual([
      expect.objectContaining({ id: 'openai', name: 'openai', models: ['gpt-4o'] }),
    ]);
    expect(result.current.models).toEqual([{ provider: 'openai', model: 'gpt-4o' }]);
  });

  it('returns empty providers and models before the endpoint resolves', () => {
    getBuilderAvailableModels.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useAgentBuilderAllowedModels(), { wrapper: createWrapper() });

    expect(result.current.providers).toEqual([]);
    expect(result.current.models).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it('exposes every model the endpoint already filtered to (provider-wide allow)', async () => {
    getBuilderAvailableModels.mockResolvedValue({
      providers: [
        { id: 'openai', name: 'openai', envVar: 'OPENAI_API_KEY', connected: true, models: ['gpt-4o', 'gpt-4o-mini'] },
      ],
    });

    const { result } = renderHook(() => useAgentBuilderAllowedModels(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.providers).toHaveLength(1));
    expect(result.current.providers[0]).toEqual(
      expect.objectContaining({ id: 'openai', models: ['gpt-4o', 'gpt-4o-mini'] }),
    );
    expect(result.current.models).toEqual([
      { provider: 'openai', model: 'gpt-4o' },
      { provider: 'openai', model: 'gpt-4o-mini' },
    ]);
  });
});

describe('isModelNotAllowedError', () => {
  it('returns the error message when the code matches', async () => {
    const { isModelNotAllowedError } = await import('@/domains/agent-builder/utils/is-model-not-allowed');
    const err = Object.assign(new Error('Choose another model'), { code: 'MODEL_NOT_ALLOWED' });
    expect(isModelNotAllowedError(err)).toEqual({ message: 'Choose another model' });
    expect(isModelNotAllowedError({ code: 'MODEL_NOT_ALLOWED' })).toEqual({ message: 'Model is not allowed' });
    expect(isModelNotAllowedError({ code: 'OTHER' })).toBeNull();
    expect(isModelNotAllowedError(null)).toBeNull();
  });
});

describe('useBuilderSettings', () => {
  it('fetches builder settings through the Mastra client', async () => {
    const { result } = renderHook(() => useBuilderSettings(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getBuilderSettings).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(builderSettings);
  });

  it('does not fetch when disabled', () => {
    const { result } = renderHook(() => useBuilderSettings({ enabled: false }), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getBuilderSettings).not.toHaveBeenCalled();
  });

  it('returns query errors from failed settings requests', async () => {
    server.use(
      http.get('http://localhost/api/builder/settings', () => HttpResponse.json({ message: 'nope' }, { status: 500 })),
    );

    const { result } = renderHook(() => useBuilderSettings(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useIsBuilderEnabled', () => {
  it('reports enabled when the server returns enabled true', async () => {
    const { result } = renderHook(() => useIsBuilderEnabled(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current).toMatchObject({ isEnabled: true, error: null });
  });

  it('reports disabled for missing or false enabled values', async () => {
    server.use(http.get('http://localhost/api/builder/settings', () => HttpResponse.json({ enabled: false })));

    const { result, rerender } = renderHook(() => useIsBuilderEnabled(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isEnabled).toBe(false);

    server.use(http.get('http://localhost/api/builder/settings', () => HttpResponse.json({})));
    rerender();

    expect(result.current.isEnabled).toBe(false);
  });

  it('exposes errors while treating the builder as disabled', async () => {
    server.use(http.get('http://localhost/api/builder/settings', () => new HttpResponse(null, { status: 500 })));

    const { result } = renderHook(() => useIsBuilderEnabled(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.isEnabled).toBe(false);
  });
});

describe('useBuilderModelPolicy', () => {
  it('returns the server-provided model policy', async () => {
    const { result } = renderHook(() => useBuilderModelPolicy(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.active).toBe(true));

    expect(result.current).toEqual(builderSettings.modelPolicy);
  });

  it('returns the inactive policy when the server omits modelPolicy', async () => {
    server.use(http.get('http://localhost/api/builder/settings', () => HttpResponse.json({ enabled: true })));

    const { result } = renderHook(() => useBuilderModelPolicy(), { wrapper: createWrapper() });

    await waitFor(() => expect(getBuilderSettings).toHaveBeenCalledTimes(1));

    expect(result.current).toEqual({ active: false });
  });
});

describe('useBuilderPickerVisibility', () => {
  it('returns unrestricted picker visibility before data loads and when picker is omitted', async () => {
    server.use(http.get('http://localhost/api/builder/settings', () => HttpResponse.json({ enabled: true })));

    const { result } = renderHook(() => useBuilderPickerVisibility(), { wrapper: createWrapper() });

    expect(result.current).toEqual({ visibleTools: null, visibleAgents: null, visibleWorkflows: null });
    await waitFor(() => expect(getBuilderSettings).toHaveBeenCalledTimes(1));
    expect(result.current).toEqual({ visibleTools: null, visibleAgents: null, visibleWorkflows: null });
  });

  it('converts picker allowlists to sets and preserves null unrestricted values', async () => {
    server.use(
      http.get('http://localhost/api/builder/settings', () =>
        HttpResponse.json({
          enabled: true,
          picker: {
            visibleTools: null,
            visibleAgents: ['agent-a', 'agent-b'],
            visibleWorkflows: [],
          },
        }),
      ),
    );

    const { result } = renderHook(() => useBuilderPickerVisibility(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.visibleAgents).toBeInstanceOf(Set));

    expect(result.current.visibleTools).toBeNull();
    expect([...result.current.visibleAgents!]).toEqual(['agent-a', 'agent-b']);
    expect([...result.current.visibleWorkflows!]).toEqual([]);
  });

  it('supports restricted tools with unrestricted agents and workflows', async () => {
    server.use(
      http.get('http://localhost/api/builder/settings', () =>
        HttpResponse.json({
          enabled: true,
          picker: {
            visibleTools: ['tool-a'],
            visibleAgents: null,
            visibleWorkflows: null,
          },
        }),
      ),
    );

    const { result } = renderHook(() => useBuilderPickerVisibility(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.visibleTools).toBeInstanceOf(Set));

    expect([...result.current.visibleTools!]).toEqual(['tool-a']);
    expect(result.current.visibleAgents).toBeNull();
    expect(result.current.visibleWorkflows).toBeNull();
  });
});

describe('useBuilderAgentFeatures', () => {
  it('maps enabled agent feature flags to booleans', async () => {
    const { result } = renderHook(() => useBuilderAgentFeatures(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.browser).toBe(true));

    expect(result.current).toEqual({
      tools: true,
      memory: true,
      workflows: true,
      agents: true,
      avatarUpload: true,
      skills: true,
      model: true,
      favorites: true,
      browser: true,
    });
  });

  it('defaults every feature to false when settings or agent features are missing', async () => {
    server.use(
      http.get('http://localhost/api/builder/settings', () => HttpResponse.json({ enabled: true, features: {} })),
    );

    const { result } = renderHook(() => useBuilderAgentFeatures(), { wrapper: createWrapper() });

    expect(result.current).toEqual({
      tools: false,
      memory: false,
      workflows: false,
      agents: false,
      avatarUpload: false,
      skills: false,
      model: false,
      favorites: false,
      browser: false,
    });

    await waitFor(() => expect(getBuilderSettings).toHaveBeenCalledTimes(1));
    expect(result.current).toEqual({
      tools: false,
      memory: false,
      workflows: false,
      agents: false,
      avatarUpload: false,
      skills: false,
      model: false,
      favorites: false,
      browser: false,
    });
  });

  it('treats non-true feature values as disabled', async () => {
    server.use(
      http.get('http://localhost/api/builder/settings', () =>
        HttpResponse.json({
          enabled: true,
          features: {
            agent: {
              tools: false,
              memory: 'yes',
              workflows: 1,
              agents: null,
              avatarUpload: undefined,
              skills: true,
              model: false,
              favorites: true,
              browser: false,
            },
          },
        }),
      ),
    );

    const { result } = renderHook(() => useBuilderAgentFeatures(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.skills).toBe(true));

    expect(result.current).toEqual({
      tools: false,
      memory: false,
      workflows: false,
      agents: false,
      avatarUpload: false,
      skills: true,
      model: false,
      favorites: true,
      browser: false,
    });
  });
});

describe('useBuilderAgentAccess and useCanCreateAgent', () => {
  it('allows access when RBAC permissions and builder feature are available', async () => {
    permissionState.rbacEnabled = true;
    const { result } = renderHook(() => useBuilderAgentAccess(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current).toMatchObject({
      denialReason: null,
      isBuilderEnabled: true,
      hasAgentFeature: true,
      hasRequiredPermissions: true,
      canAccessAgentBuilder: true,
      canWrite: true,
      canExecute: true,
      canManageSkills: true,
      canUseFavorites: true,
    });
  });

  it('does not fetch settings when RBAC denies read access', () => {
    permissionState.rbacEnabled = true;
    hasAnyPermission.mockReturnValue(false);
    hasPermission.mockReturnValue(false);

    const { result } = renderHook(() => useBuilderAgentAccess(), { wrapper: createWrapper() });

    expect(result.current).toMatchObject({
      isLoading: false,
      error: null,
      denialReason: 'permission-denied',
      hasRequiredPermissions: false,
      canAccessAgentBuilder: false,
      canWrite: false,
      canExecute: false,
      canManageSkills: false,
      canUseFavorites: false,
    });
    expect(getBuilderSettings).not.toHaveBeenCalled();
  });

  it('returns error denial when settings fail after permissions allow access', async () => {
    permissionState.rbacEnabled = true;
    server.use(http.get('http://localhost/api/builder/settings', () => new HttpResponse(null, { status: 500 })));

    const { result } = renderHook(() => useBuilderAgentAccess(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.denialReason).toBe('error'));
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('routes create requests to builder only when builder access is configured', async () => {
    const { result } = renderHook(() => useCanCreateAgent(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toEqual({
      canCreateAgent: true,
      createRoute: '/agent-builder/agents/create',
      isLoading: false,
    });
  });

  it('keeps legacy create route when only the experimental UI flag is enabled', async () => {
    server.use(http.get('http://localhost/api/builder/settings', () => HttpResponse.json({ enabled: false })));
    const flagWindow = window as unknown as Record<string, unknown>;
    const prev = flagWindow.MASTRA_EXPERIMENTAL_UI;
    flagWindow.MASTRA_EXPERIMENTAL_UI = 'true';
    try {
      const { result } = renderHook(() => useCanCreateAgent(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current).toEqual({ canCreateAgent: true, createRoute: '/cms/agents/create', isLoading: false });
    } finally {
      if (prev === undefined) {
        delete flagWindow.MASTRA_EXPERIMENTAL_UI;
      } else {
        flagWindow.MASTRA_EXPERIMENTAL_UI = prev;
      }
    }
  });
});

describe('form-backed tools', () => {
  it('exposes the full set of atomic agent-builder tools when every feature is on', async () => {
    const wrapper = createFormWrapper({ skills: { existing: true } });
    const features = {
      tools: true,
      memory: false,
      workflows: true,
      agents: true,
      avatarUpload: false,
      skills: true,
      model: true,
      favorites: false,
      browser: true,
    };
    const availableAgentTools = [
      { id: 'tool-a', type: 'tool', name: 'Tool A' },
      { id: 'agent-a', type: 'agent', name: 'Agent A' },
      { id: 'workflow-a', type: 'workflow', name: 'Workflow A' },
    ] as any[];
    const { result } = renderHook(
      () =>
        useAgentBuilderTool({
          features,
          availableAgentTools,
          availableSkills: [{ id: 'skill-a' }, { id: 'skill-b' }] as any[],
          availableWorkspaces: [{ id: 'workspace-a', name: 'Workspace A' }],
          availableModels: [{ provider: 'openai', name: 'gpt-4o' }] as any[],
        }),
      { wrapper },
    );

    const record = result.current as Record<string, any>;
    expect(record['set-agent-name']).toBeDefined();
    expect(record['set-agent-description']).toBeDefined();
    expect(record['set-agent-instructions']).toBeDefined();
    expect(record['set-agent-tools']).toBeDefined();
    expect(record['set-agent-skills']).toBeDefined();
    expect(record['set-agent-model']).toBeDefined();
    expect(record['set-agent-browser-enabled']).toBeDefined();
    expect(record['set-agent-workspace-id']).toBeDefined();
  });

  it('omits gated agent-builder tools and keeps the always-on ones', async () => {
    const wrapper = createFormWrapper();
    const features = {
      tools: false,
      memory: false,
      workflows: false,
      agents: false,
      avatarUpload: false,
      skills: false,
      model: false,
      favorites: false,
      browser: false,
    };
    const { result } = renderHook(
      () =>
        useAgentBuilderTool({
          features,
          availableAgentTools: [{ id: 'tool-a', type: 'tool', name: 'Tool A' }] as any[],
          availableSkills: [{ id: 'skill-a' }] as any[],
        }),
      { wrapper },
    );

    const record = result.current as Record<string, any>;
    expect(record['set-agent-tools']).toBeUndefined();
    expect(record['set-agent-skills']).toBeUndefined();
    expect(record['set-agent-model']).toBeUndefined();
    expect(record['set-agent-browser-enabled']).toBeUndefined();

    expect(record['set-agent-name']).toBeDefined();
    expect(record['set-agent-description']).toBeDefined();
    expect(record['set-agent-instructions']).toBeDefined();
    expect(record['set-agent-workspace-id']).toBeDefined();
  });

  it('creates and attaches a skill, defaulting the only workspace and visibility', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: 'skill-created' });
    useCreateSkill.mockReturnValue({ mutateAsync, isPending: false });
    useDefaultVisibility.mockReturnValue('public');
    const wrapper = createFormWrapper({ skills: { existing: true } });
    const { result } = renderHook(
      () => useCreateSkillTool({ availableWorkspaces: [{ id: 'workspace-a', name: 'Workspace A' }] }),
      {
        wrapper,
      },
    );

    const output = await (result.current as any).execute({
      name: 'Skill',
      description: 'Desc',
      instructions: '# Skill',
    });

    expect(output).toEqual({ success: true, skillId: 'skill-created' });
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Skill',
        description: 'Desc',
        visibility: 'public',
        workspaceId: 'workspace-a',
      }),
    );
  });

  it('creates a skill when no skills are currently selected', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: 'skill-created' });
    useCreateSkill.mockReturnValue({ mutateAsync, isPending: false });
    const wrapper = createFormWrapper({});
    const { result } = renderHook(
      () => useCreateSkillTool({ availableWorkspaces: [{ id: 'workspace-a', name: 'Workspace A' }] }),
      {
        wrapper,
      },
    );

    await expect((result.current as any).execute({ name: 'Skill', instructions: 'Body' })).resolves.toEqual({
      success: true,
      skillId: 'skill-created',
    });
  });

  it('requires workspaceId in the input schema when multiple workspaces are available', () => {
    const wrapper = createFormWrapper();
    const { result } = renderHook(
      () =>
        useCreateSkillTool({
          availableWorkspaces: [
            { id: 'workspace-a', name: 'A' },
            { id: 'workspace-b', name: 'B' },
          ],
        }),
      { wrapper },
    );
    const tool = result.current as any;
    const missing = tool.inputSchema.safeParse({ name: 'Skill', description: 'Desc', instructions: 'Body' });
    expect(missing.success).toBe(false);
    const ok = tool.inputSchema.safeParse({
      name: 'Skill',
      description: 'Desc',
      instructions: 'Body',
      workspaceId: 'workspace-a',
    });
    expect(ok.success).toBe(true);
  });

  it('returns tool errors for missing workspace and create failures', async () => {
    const wrapper = createFormWrapper();
    const { result, rerender } = renderHook(() => useCreateSkillTool(), { wrapper });
    await expect((result.current as any).execute()).resolves.toEqual({
      success: false,
      error: 'No workspace available for skill creation.',
    });
    await expect(
      (result.current as any).execute({ name: 'Skill', description: 'Desc', instructions: 'Body' }),
    ).resolves.toEqual({
      success: false,
      error: 'No workspace available for skill creation.',
    });

    const mutateAsync = vi.fn().mockRejectedValueOnce(new Error('boom')).mockRejectedValueOnce('bad');
    useCreateSkill.mockReturnValue({ mutateAsync, isPending: false });
    rerender();
    await expect(
      (result.current as any).execute({ name: 'Skill', description: 'Desc', instructions: 'Body', workspaceId: 'w' }),
    ).resolves.toEqual({ success: false, error: 'boom' });
    await expect(
      (result.current as any).execute({ name: 'Skill', description: 'Desc', instructions: 'Body', workspaceId: 'w' }),
    ).resolves.toEqual({ success: false, error: 'Failed to create skill' });
  });
});

describe('save and autosave hooks', () => {
  it('saves agents with converted form params and success callback', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: 'agent-id' });
    useStoredAgentMutations.mockReturnValue({ updateStoredAgent: { mutateAsync, isPending: false } });
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useSaveAgent({ agentId: 'agent-id', onSuccess }));

    await result.current.save({ name: 'Agent', description: 'Desc', instructions: 'Instructions' } as any);

    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ name: 'Agent', visibility: 'private' }));
    expect(toast.success).toHaveBeenCalledWith('Agent updated');
    expect(onSuccess).toHaveBeenCalledWith('agent-id');
  });

  it('includes workspace and avatar metadata when saving agents silently', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: 'agent-id' });
    useStoredAgentMutations.mockReturnValue({ updateStoredAgent: { mutateAsync, isPending: false } });
    const { result } = renderHook(() => useSaveAgent({ agentId: 'agent-id', silent: true }));

    await result.current.save({
      name: 'Agent',
      description: 'Description',
      instructions: 'Instructions',
      workspaceId: 'workspace-id',
      avatarUrl: 'https://example.com/avatar.png',
      visibility: 'public',
      browserEnabled: false,
    } as any);

    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: { type: 'id', workspaceId: 'workspace-id' },
        metadata: { avatarUrl: 'https://example.com/avatar.png' },
        visibility: 'public',
        browser: false,
      }),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('surfaces save failures through toast and rethrows', async () => {
    useStoredAgentMutations.mockReturnValue({
      updateStoredAgent: { mutateAsync: vi.fn().mockRejectedValue(new Error('nope')), isPending: false },
    });
    const { result } = renderHook(() => useSaveAgent({ agentId: 'agent-id' }));
    await expect(result.current.save({ name: 'Agent', instructions: '' } as any)).rejects.toThrow('nope');
    expect(toast.error).toHaveBeenCalledWith('Failed to save agent: nope');
  });

  it('shows model policy and unknown save errors', async () => {
    useStoredAgentMutations.mockReturnValue({
      updateStoredAgent: {
        mutateAsync: vi.fn().mockRejectedValue({ code: 'MODEL_NOT_ALLOWED', message: 'Choose another model' }),
        isPending: true,
      },
    });
    const policyResult = renderHook(() => useSaveAgent({ agentId: 'agent-id' }));
    expect(policyResult.result.current.isSaving).toBe(true);
    await expect(policyResult.result.current.save({ name: 'Agent', instructions: '' } as any)).rejects.toEqual(
      expect.objectContaining({ code: 'MODEL_NOT_ALLOWED' }),
    );
    expect(toast.error).toHaveBeenCalledWith('Model is not allowed');

    useStoredAgentMutations.mockReturnValue({
      updateStoredAgent: { mutateAsync: vi.fn().mockRejectedValue('bad'), isPending: false },
    });
    const unknownResult = renderHook(() => useSaveAgent({ agentId: 'agent-id' }));
    await expect(unknownResult.result.current.save({ name: 'Agent', instructions: '' } as any)).rejects.toBe('bad');
    expect(toast.error).toHaveBeenCalledWith('Failed to save agent: Unknown error');
  });

  it('autosaves agent changes, retries failures, flushes pending changes, and clears saved status', async () => {
    vi.useFakeTimers();
    const mutateAsync = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue({ id: 'agent-id' });
    useStoredAgentMutations.mockReturnValue({ updateStoredAgent: { mutateAsync, isPending: false } });
    let methods: any;
    const Wrapper = ({ children }: PropsWithChildren) => {
      methods = useForm({ defaultValues: { name: 'Agent', instructions: 'old' } });
      return <FormProvider {...methods}>{children}</FormProvider>;
    };
    const { result, unmount } = renderHook(
      () => useAutosaveAgent({ agentId: 'agent-id', debounceMs: 10, savedDisplayMs: 10_000 }),
      { wrapper: Wrapper },
    );

    await act(async () => {
      result.current.retry();
    });
    await vi.waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.lastError?.message).toBe('fail');

    await act(async () => {
      result.current.retry();
    });
    await vi.waitFor(() => expect(result.current.status).toBe('saved'));
    act(() => vi.advanceTimersByTime(10_000));
    await vi.waitFor(() => expect(result.current.status).toBe('idle'));

    await act(async () => {
      result.current.retry();
    });
    await vi.waitFor(() => expect(result.current.status).toBe('saved'));

    act(() => methods.setValue('name', 'Changed'));
    await act(async () => {
      result.current.flushNow();
    });
    await vi.waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(4));

    unmount();
    act(() => vi.advanceTimersByTime(20));
  });

  it('autosaves skill changes with generated files', async () => {
    vi.useFakeTimers();
    const mutateAsync = vi.fn().mockResolvedValue({ id: 'skill-id' });
    useUpdateSkill.mockReturnValue({ mutateAsync, isPending: false });
    const wrapper = createFormWrapper({
      name: 'Skill',
      description: 'Desc',
      instructions: 'Body',
      visibility: 'public',
      workspaceId: 'w',
    });
    const { result } = renderHook(() => useAutosaveSkill({ skillId: 'skill-id', debounceMs: 10, savedDisplayMs: 10 }), {
      wrapper,
    });

    await act(async () => {
      result.current.retry();
    });

    await vi.waitFor(() => expect(result.current.status).toBe('saved'));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'skill-id', name: 'Skill', files: expect.any(Object) }),
    );
    act(() => vi.advanceTimersByTime(10));
    await vi.waitFor(() => expect(result.current.status).toBe('idle'));
  });

  it('ignores stale autosave agent success and error completions', async () => {
    const saves = [deferred(), deferred(), deferred(), deferred()];
    const mutateAsync = vi
      .fn()
      .mockReturnValueOnce(saves[0].promise)
      .mockReturnValueOnce(saves[1].promise)
      .mockReturnValueOnce(saves[2].promise)
      .mockReturnValueOnce(saves[3].promise);
    useStoredAgentMutations.mockReturnValue({ updateStoredAgent: { mutateAsync, isPending: false } });
    const wrapper = createFormWrapper({ name: 'Agent', instructions: 'old' });
    const { result } = renderHook(() => useAutosaveAgent({ agentId: 'agent-id' }), { wrapper });

    act(() => result.current.retry());
    act(() => result.current.retry());
    await act(async () => saves[1].resolve({ id: 'agent-id' }));
    await waitFor(() => expect(result.current.status).toBe('saved'));
    await act(async () => saves[0].resolve({ id: 'agent-id' }));

    act(() => result.current.retry());
    act(() => result.current.retry());
    await act(async () => saves[3].resolve({ id: 'agent-id' }));
    await waitFor(() => expect(result.current.status).toBe('saved'));
    await act(async () => saves[2].reject(new Error('stale')));
    expect(result.current.status).toBe('saved');
  });

  it('stores non-error autosave agent failures as errors', async () => {
    const mutateAsync = vi.fn().mockRejectedValue('fail');
    useStoredAgentMutations.mockReturnValue({ updateStoredAgent: { mutateAsync, isPending: false } });
    const wrapper = createFormWrapper({ name: 'Agent', instructions: 'old' });
    const { result } = renderHook(() => useAutosaveAgent({ agentId: 'agent-id' }), { wrapper });

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.lastError?.message).toBe('fail'));
  });

  it('handles autosave skill failures, retries, and flushes watched changes with untitled fallback', async () => {
    const mutateAsync = vi.fn().mockRejectedValueOnce('fail').mockResolvedValue({ id: 'skill-id' });
    useUpdateSkill.mockReturnValue({ mutateAsync, isPending: false });
    let methods: any;
    const Wrapper = ({ children }: PropsWithChildren) => {
      methods = useForm({
        defaultValues: { name: '', description: 'Desc', instructions: undefined, visibility: 'private' },
      });
      return <FormProvider {...methods}>{children}</FormProvider>;
    };
    const { result } = renderHook(() => useAutosaveSkill({ skillId: 'skill-id' }), { wrapper: Wrapper });

    await act(async () => {
      result.current.retry();
    });
    await vi.waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.lastError?.message).toBe('fail');

    await act(async () => {
      result.current.retry();
    });
    await vi.waitFor(() => expect(result.current.status).toBe('saved'));
    expect(mutateAsync).toHaveBeenLastCalledWith(expect.objectContaining({ name: '', instructions: undefined }));

    act(() => methods.setValue('description', 'Changed'));
    await act(async () => {
      result.current.flushNow();
    });
    await vi.waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(3));
  });

  it('stores Error autosave skill failures as errors', async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error('fail'));
    useUpdateSkill.mockReturnValue({ mutateAsync, isPending: false });
    const wrapper = createFormWrapper({ name: 'Skill', instructions: 'Body' });
    const { result } = renderHook(() => useAutosaveSkill({ skillId: 'skill-id' }), { wrapper });

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.lastError?.message).toBe('fail'));
  });

  it('ignores stale autosave skill success and error completions', async () => {
    const saves = [deferred(), deferred(), deferred(), deferred()];
    const mutateAsync = vi
      .fn()
      .mockReturnValueOnce(saves[0].promise)
      .mockReturnValueOnce(saves[1].promise)
      .mockReturnValueOnce(saves[2].promise)
      .mockReturnValueOnce(saves[3].promise);
    useUpdateSkill.mockReturnValue({ mutateAsync, isPending: false });
    const wrapper = createFormWrapper({ name: 'Skill', instructions: 'Body' });
    const { result } = renderHook(() => useAutosaveSkill({ skillId: 'skill-id' }), { wrapper });

    act(() => result.current.retry());
    act(() => result.current.retry());
    await act(async () => saves[1].resolve({ id: 'skill-id' }));
    await waitFor(() => expect(result.current.status).toBe('saved'));
    await act(async () => saves[0].resolve({ id: 'skill-id' }));

    act(() => result.current.retry());
    act(() => result.current.retry());
    await act(async () => saves[3].resolve({ id: 'skill-id' }));
    await waitFor(() => expect(result.current.status).toBe('saved'));
    await act(async () => saves[2].reject(new Error('stale')));
    expect(result.current.status).toBe('saved');
  });
});

describe('small interaction hooks', () => {
  it('scrolls to the bottom when its dependency changes', () => {
    const scrollTo = vi.fn();
    const { result, rerender } = renderHook(({ dep }) => useAutoScroll(dep), { initialProps: { dep: 1 } });
    Object.defineProperties(result.current, { current: { value: { scrollHeight: 123, scrollTo }, writable: true } });
    rerender({ dep: 2 });
    expect(scrollTo).toHaveBeenCalledWith({ top: 123, behavior: 'smooth' });
  });

  it('submits trimmed chat drafts with Enter and ignores blank/composing input', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() => useChatDraft({ onSubmit }));
    const preventDefault = vi.fn();
    const requestSubmit = vi.fn();

    act(() => result.current.handleFormSubmit({ preventDefault } as any));
    expect(onSubmit).not.toHaveBeenCalled();

    act(() => result.current.setDraft('  hello  '));
    act(() => result.current.handleFormSubmit({ preventDefault } as any));
    expect(onSubmit).toHaveBeenCalledWith('hello');
    expect(result.current.draft).toBe('');

    act(() => result.current.setDraft('next'));
    result.current.handleKeyDown({
      key: 'Enter',
      shiftKey: false,
      nativeEvent: { isComposing: false },
      preventDefault,
      currentTarget: { form: { requestSubmit } },
    } as any);
    expect(requestSubmit).toHaveBeenCalled();
    result.current.handleKeyDown({
      key: 'Enter',
      shiftKey: true,
      nativeEvent: { isComposing: false },
      preventDefault,
      currentTarget: { form: { requestSubmit } },
    } as any);
  });

  it('shows channel connection success and error toasts once per key', () => {
    const wrapper = ({ children }: PropsWithChildren) => (
      <StrictMode>
        <MemoryRouter initialEntries={['/?channel_connected=true&platform=slack&team=Core']}>{children}</MemoryRouter>
      </StrictMode>
    );
    const { rerender } = renderHook(() => useChannelConnectToast(), { wrapper });
    expect(toast.success).toHaveBeenCalledWith('Connected to Slack workspace "Core"');
    rerender();
    expect(toast.success).toHaveBeenCalledTimes(1);

    const noTeamWrapper = ({ children }: PropsWithChildren) => (
      <MemoryRouter initialEntries={['/?channel_connected=true']}>{children}</MemoryRouter>
    );
    renderHook(() => useChannelConnectToast(), { wrapper: noTeamWrapper });
    expect(toast.success).toHaveBeenCalledWith('Connected to channel');

    const errorWrapper = ({ children }: PropsWithChildren) => (
      <MemoryRouter initialEntries={['/?channel_error=denied&platform=discord']}>{children}</MemoryRouter>
    );
    renderHook(() => useChannelConnectToast(), { wrapper: errorWrapper });
    expect(toast.error).toHaveBeenCalledWith('Failed to connect Discord: denied');

    const noopWrapper = ({ children }: PropsWithChildren) => (
      <MemoryRouter initialEntries={['/']}>{children}</MemoryRouter>
    );
    renderHook(() => useChannelConnectToast(), { wrapper: noopWrapper });
  });

  it('captures starter user messages once and clears location state via navigate', () => {
    navigateSpy.mockClear();
    const wrapper = ({ children }: PropsWithChildren) => (
      <MemoryRouter initialEntries={[{ pathname: '/agent-builder/agents/a', state: { userMessage: 'start' } }]}>
        {children}
      </MemoryRouter>
    );
    const { result } = renderHook(() => useStarterUserMessage(), { wrapper });
    expect(result.current).toBe('start');
    expect(navigateSpy).toHaveBeenCalledWith('.', { replace: true, state: null });
  });

  it('returns undefined starter messages without calling navigate', () => {
    navigateSpy.mockClear();
    const wrapper = ({ children }: PropsWithChildren) => (
      <MemoryRouter initialEntries={['/agent-builder/agents/a']}>{children}</MemoryRouter>
    );
    const { result } = renderHook(() => useStarterUserMessage(), { wrapper });
    expect(result.current).toBeUndefined();
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});

describe('available tools and visibility dialogs', () => {
  it('filters available agent tools using picker allowlists', async () => {
    server.use(
      http.get('http://localhost/api/builder/settings', () =>
        HttpResponse.json({
          enabled: true,
          picker: { visibleTools: ['tool-a'], visibleAgents: ['agent-a'], visibleWorkflows: [] },
        }),
      ),
    );
    const { result } = renderHook(
      () =>
        useAvailableAgentTools({
          toolsData: { 'tool-a': { id: 'tool-a' }, 'tool-b': { id: 'tool-b' } },
          agentsData: { 'agent-a': { id: 'agent-a' }, 'agent-b': { id: 'agent-b' } },
          workflowsData: { 'workflow-a': { id: 'workflow-a' } },
          selectedTools: { 'tool-a': true },
          selectedAgents: undefined,
          selectedWorkflows: undefined,
          excludeAgentId: 'agent-b',
        }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.map(tool => tool.id)).not.toContain('tool-b'));
    expect(getBuilderSettings).toHaveBeenCalledTimes(1);
    expect(result.current.map(tool => tool.id)).toEqual(expect.arrayContaining(['tool-a', 'agent-a']));
    expect(result.current.map(tool => tool.id)).not.toContain('workflow-a');
  });

  it('defaults missing workflows data to an empty record', async () => {
    const { result } = renderHook(
      () =>
        useAvailableAgentTools({
          toolsData: {},
          agentsData: {},
          selectedTools: undefined,
          selectedAgents: undefined,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(getBuilderSettings).toHaveBeenCalledTimes(1));
    expect(result.current).toEqual([]);
  });

  it('confirms and cancels agent visibility changes', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    useStoredAgentMutations.mockReturnValue({ updateStoredAgent: { mutateAsync, isPending: false } });
    const Probe = () => {
      const { requestChange, dialog } = useAgentVisibilityChange('agent-id');
      return (
        <>
          <button onClick={() => requestChange('public')}>open</button>
          <button onClick={() => requestChange('private')}>open-private</button>
          {dialog}
        </>
      );
    };
    render(<Probe />, { wrapper: createFormWrapper({ visibility: 'private' }) });
    fireEvent.click(screen.getByText('open-private'));
    fireEvent.click(screen.getByTestId('agent-builder-visibility-confirm-cancel'));
    expect(mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('open'));
    fireEvent.click(screen.getByTestId('agent-builder-visibility-confirm-yes'));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ visibility: 'public' }));
    expect(toast.success).toHaveBeenCalledWith('Agent added to the library');
  });

  it('shows errors when agent visibility fails', async () => {
    const mutateAsync = vi.fn().mockRejectedValueOnce(new Error('denied')).mockRejectedValueOnce('denied');
    useStoredAgentMutations.mockReturnValue({ updateStoredAgent: { mutateAsync, isPending: false } });
    const Probe = () => {
      const { requestChange, dialog } = useAgentVisibilityChange('agent-id');
      return (
        <>
          <button onClick={() => requestChange('private')}>open-private</button>
          {dialog}
        </>
      );
    };
    render(<Probe />, { wrapper: createFormWrapper({ visibility: 'public' }) });
    fireEvent.click(screen.getByText('open-private'));
    fireEvent.click(screen.getByTestId('agent-builder-visibility-confirm-yes'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to update visibility: denied'));
    fireEvent.click(screen.getByText('open-private'));
    fireEvent.click(screen.getByTestId('agent-builder-visibility-confirm-yes'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to update visibility: Unknown error'));
  });

  it('confirms, cancels, and reports skill visibility changes', async () => {
    const mutateAsync = vi.fn().mockRejectedValueOnce(new Error('denied')).mockResolvedValueOnce({});
    useUpdateSkill.mockReturnValue({ mutateAsync, isPending: false });
    const Probe = () => {
      const { requestChange, dialog } = useSkillVisibilityChange('skill-id');
      return (
        <>
          <button onClick={() => requestChange('private')}>open-private</button>
          <button onClick={() => requestChange('public')}>open-public</button>
          {dialog}
        </>
      );
    };
    render(<Probe />, { wrapper: createFormWrapper({ visibility: 'public' }) });
    fireEvent.click(screen.getByText('open-private'));
    fireEvent.click(screen.getByTestId('skill-builder-visibility-confirm-cancel'));
    expect(mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('open-private'));
    fireEvent.click(screen.getByTestId('skill-builder-visibility-confirm-yes'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to update visibility: denied'));
    fireEvent.click(screen.getByText('open-public'));
    fireEvent.click(screen.getByTestId('skill-builder-visibility-confirm-yes'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Skill added to the library'));
  });

  it('shows an unknown error when skill visibility fails with a non-error value', async () => {
    const mutateAsync = vi.fn().mockRejectedValue('denied');
    useUpdateSkill.mockReturnValue({ mutateAsync, isPending: false });
    const Probe = () => {
      const { requestChange, dialog } = useSkillVisibilityChange('skill-id');
      return (
        <>
          <button onClick={() => requestChange('private')}>open</button>
          {dialog}
        </>
      );
    };
    render(<Probe />, { wrapper: createFormWrapper({ visibility: 'public' }) });
    fireEvent.click(screen.getByText('open'));
    fireEvent.click(screen.getByTestId('skill-builder-visibility-confirm-yes'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to update visibility: Unknown error'));
  });
});
