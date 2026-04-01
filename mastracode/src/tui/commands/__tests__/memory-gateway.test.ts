import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockLoadSettings, mockSaveSettings } = vi.hoisted(() => ({
  mockLoadSettings: vi.fn(),
  mockSaveSettings: vi.fn(),
}));

vi.mock('../../../onboarding/settings.js', () => ({
  loadSettings: mockLoadSettings,
  saveSettings: mockSaveSettings,
  MEMORY_GATEWAY_PROVIDER: 'mastra-gateway',
  MEMORY_GATEWAY_DEFAULT_URL: 'https://server.mastra.ai',
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
    delete process.env.MASTRA_GATEWAY_API_KEY;
    delete process.env.MASTRA_GATEWAY_URL;
    mockLoadSettings.mockReturnValue({ memoryGateway: {} });
  });

  it('stores the API key and updates the gateway URL', async () => {
    const { ctx, authStorage, components } = createCtx();
    authStorage.getStoredApiKey.mockReturnValue(undefined);

    const promise = handleMemoryGatewayCommand(ctx);

    expect(components).toHaveLength(1);
    components[0]!.config.onSubmit('mg_test_key');
    await Promise.resolve();

    expect(components).toHaveLength(2);
    components[1]!.config.onSubmit('https://gateway.example.com');
    await promise;

    expect(authStorage.setStoredApiKey).toHaveBeenCalledWith('mastra-gateway', 'mg_test_key', 'MASTRA_GATEWAY_API_KEY');
    expect(mockSaveSettings).toHaveBeenCalledWith({ memoryGateway: { baseUrl: 'https://gateway.example.com' } });
    expect(ctx.showInfo).toHaveBeenLastCalledWith(
      'Memory gateway configured. Note: model list and memory mode changes take effect on next restart.',
    );
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
    expect(ctx.showInfo).toHaveBeenLastCalledWith(
      'Memory gateway cleared. Note: model list and memory mode changes take effect on next restart.',
    );
  });
});
