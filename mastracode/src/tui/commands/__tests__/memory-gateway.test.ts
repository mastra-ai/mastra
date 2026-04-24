import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGatewayRegistryGetInstance, mockGatewayRegistrySyncGateways, mockLoadSettings, mockSaveSettings } =
  vi.hoisted(() => ({
    mockGatewayRegistryGetInstance: vi.fn(),
    mockGatewayRegistrySyncGateways: vi.fn(),
    mockLoadSettings: vi.fn(),
    mockSaveSettings: vi.fn(),
  }));

vi.mock('@mastra/core/llm', () => ({
  GatewayRegistry: {
    getInstance: mockGatewayRegistryGetInstance,
  },
}));

vi.mock('../../../onboarding/settings.js', () => ({
  loadSettings: mockLoadSettings,
  saveSettings: mockSaveSettings,
  MEMORY_GATEWAY_PROVIDER: 'mastra-gateway',
  MEMORY_GATEWAY_DEFAULT_URL: 'https://gateway-api.mastra.ai',
}));

const { MockAskQuestionInlineComponent } = vi.hoisted(() => ({
  MockAskQuestionInlineComponent: class {
    input = {
      setValue: vi.fn(),
    };

    constructor(public config: { onSubmit: (answer: string) => void; onCancel: () => void }) {}
  },
}));

vi.mock('../../components/ask-question-inline.js', () => ({
  AskQuestionInlineComponent: MockAskQuestionInlineComponent,
}));

vi.mock('@mariozechner/pi-tui', () => ({
  Spacer: class {
    constructor(_size: number) {}
  },
}));

import { handleMemoryGatewayCommand } from '../memory-gateway.js';

function createCtx() {
  const components: InstanceType<typeof MockAskQuestionInlineComponent>[] = [];
  const authStorage = {
    getStoredApiKey: vi.fn(),
    setStoredApiKey: vi.fn(),
    remove: vi.fn(),
  };

  const ctx = {
    authStorage,
    showInfo: vi.fn(),
    showError: vi.fn(),
    state: {
      activeInlineQuestion: undefined,
      ui: { requestRender: vi.fn() },
      chatContainer: {
        addChild: vi.fn((child: unknown) => {
          if (child instanceof MockAskQuestionInlineComponent) {
            components.push(child);
          }
        }),
        invalidate: vi.fn(),
      },
    },
  } as any;

  return { ctx, authStorage, components };
}

describe('handleMemoryGatewayCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGatewayRegistryGetInstance.mockReturnValue({
      syncGateways: mockGatewayRegistrySyncGateways,
    });
    delete process.env.MASTRA_GATEWAY_API_KEY;
    delete process.env.MASTRA_GATEWAY_URL;
    mockLoadSettings.mockReturnValue({ memoryGateway: {} });
  });

  it('stores the API key and updates the gateway URL from the selected option', async () => {
    const { ctx, authStorage, components } = createCtx();
    authStorage.getStoredApiKey.mockReturnValue(undefined);

    const promise = handleMemoryGatewayCommand(ctx);

    expect(components).toHaveLength(1);
    components[0]!.config.onSubmit('mg_test_key');
    await Promise.resolve();

    expect(components).toHaveLength(2);
    components[1]!.config.onSubmit('http://localhost:4111');
    await promise;

    expect(authStorage.setStoredApiKey).toHaveBeenCalledWith('mastra-gateway', 'mg_test_key', 'MASTRA_GATEWAY_API_KEY');
    expect(mockSaveSettings).toHaveBeenCalledWith({ memoryGateway: { baseUrl: 'http://localhost:4111' } });
    expect(mockGatewayRegistryGetInstance).toHaveBeenCalledWith({ useDynamicLoading: true });
    expect(mockGatewayRegistrySyncGateways).toHaveBeenCalledWith(true);
    expect(ctx.showInfo).toHaveBeenLastCalledWith(
      'Memory gateway configured. Memory mode changes take effect on next restart.',
    );
  });

  it('prefills the existing API key and stores the localhost URL without prompting for custom input', async () => {
    const { ctx, authStorage, components } = createCtx();
    authStorage.getStoredApiKey.mockReturnValue('mg_existing_key');

    const promise = handleMemoryGatewayCommand(ctx);

    expect(components).toHaveLength(1);
    expect(components[0]!.input.setValue).toHaveBeenCalledWith('mg_existing_key');
    components[0]!.config.onCancel();
    await Promise.resolve();

    expect(components).toHaveLength(2);
    components[1]!.config.onSubmit('http://localhost:4111');
    await promise;

    expect(mockSaveSettings).toHaveBeenCalledWith({ memoryGateway: { baseUrl: 'http://localhost:4111' } });
    expect(process.env.MASTRA_GATEWAY_URL).toBe('http://localhost:4111');
    expect(mockGatewayRegistrySyncGateways).toHaveBeenCalledWith(true);
  });

  it('stores a custom gateway URL entered through the selector custom response flow', async () => {
    const { ctx, authStorage, components } = createCtx();
    authStorage.getStoredApiKey.mockReturnValue('mg_existing_key');

    const promise = handleMemoryGatewayCommand(ctx);

    expect(components).toHaveLength(1);
    components[0]!.config.onCancel();
    await Promise.resolve();

    expect(components).toHaveLength(2);
    components[1]!.config.onSubmit('https://gateway.example.com');
    await promise;

    expect(mockSaveSettings).toHaveBeenCalledWith({ memoryGateway: { baseUrl: 'https://gateway.example.com' } });
    expect(process.env.MASTRA_GATEWAY_URL).toBe('https://gateway.example.com');
    expect(mockGatewayRegistrySyncGateways).toHaveBeenCalledWith(true);
  });

  it('clears stored gateway auth and settings', async () => {
    const { ctx, authStorage, components } = createCtx();
    authStorage.getStoredApiKey.mockReturnValue('mg_existing_key');
    mockLoadSettings.mockReturnValue({ memoryGateway: { baseUrl: 'https://gateway.example.com' } });
    process.env.MASTRA_GATEWAY_API_KEY = 'mg_existing_key';
    process.env.MASTRA_GATEWAY_URL = 'https://gateway.example.com';

    const promise = handleMemoryGatewayCommand(ctx);

    expect(components).toHaveLength(1);
    components[0]!.config.onSubmit('clear');
    await promise;

    expect(authStorage.remove).toHaveBeenCalledWith('apikey:mastra-gateway');
    expect(mockSaveSettings).toHaveBeenCalledWith({ memoryGateway: {} });
    expect(process.env.MASTRA_GATEWAY_API_KEY).toBeUndefined();
    expect(process.env.MASTRA_GATEWAY_URL).toBeUndefined();
    expect(mockGatewayRegistrySyncGateways).toHaveBeenCalledWith(true);
    expect(ctx.showInfo).toHaveBeenLastCalledWith(
      'Memory gateway cleared. Memory mode changes take effect on next restart.',
    );
  });
});
