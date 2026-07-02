import '@mastra/playground-ui/style.css';
import './styles.css';

import { BrandLoader } from '@mastra/playground-ui/components/BrandLoader';
import { createRoot } from 'react-dom/client';

import {
  collectEnvironmentVariables,
  rowsFromEnvironmentVariables,
} from '../shared/environment-variables';
import type { EnvironmentVariableRow } from '../shared/environment-variables';
import { LOCAL_MODEL_PRESETS } from '../shared/model-presets';
import type { LocalModelProviderId } from '../shared/model-presets';
import type { DesktopState, DesktopTab, MastraDesktopApi, ProbeModelsResult } from '../shared/types';

import { Launcher } from './launcher';
import type { LauncherActions } from './launcher';
import { SettingsPanel } from './settings-panel';

declare global {
  interface Window {
    mastraDesktop: MastraDesktopApi;
  }
}

const api = window.mastraDesktop;
const tabStrip = document.querySelector<HTMLDivElement>('#tab-strip');
const newTabButton = document.querySelector<HTMLButtonElement>('#new-tab-button');
const settingsButton = document.querySelector<HTMLButtonElement>('#settings-button');
const launcher = document.querySelector<HTMLElement>('#launcher');
const webviews = document.querySelector<HTMLElement>('#webviews');
const bootLoader = document.querySelector<HTMLElement>('#boot-loader');
const settingsMount = document.querySelector<HTMLElement>('#settings-root');

if (!tabStrip || !newTabButton || !settingsButton || !launcher || !webviews || !bootLoader || !settingsMount) {
  throw new Error('Mastra Studio shell failed to mount');
}

const launcherRoot = createRoot(launcher);
const bootLoaderRoot = createRoot(bootLoader);
const settingsRoot = createRoot(settingsMount);

bootLoaderRoot.render(<BrandLoader aria-label="Loading Mastra Studio" size="lg" />);

let state: DesktopState | undefined;
let manualServerUrl = '4111';
let platformBaseUrl = '';
let localProviderId: LocalModelProviderId = 'lmstudio';
let localModelUrl = '';
let localModelId = '';
let localModelApiKey = '';
let localModelFieldsDirty = false;
let localModelProbe: ProbeModelsResult | undefined;
let environmentRows: EnvironmentVariableRow[] = [{ key: '', value: '' }];
let runtimeEnvironmentDirty = false;
let settingsOpen = false;
let busyAction: string | undefined;
let lastError: string | undefined;

function escapeHtml(value: string | undefined) {
  return (value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function providerForModelUrl(modelUrl: string): LocalModelProviderId {
  const normalized = modelUrl.replace(/\/$/, '');
  if (normalized === LOCAL_MODEL_PRESETS.ollama.modelUrl) return 'ollama';
  if (normalized === LOCAL_MODEL_PRESETS.lmstudio.modelUrl) return 'lmstudio';
  return 'custom';
}

function selectedLocalProvider() {
  return LOCAL_MODEL_PRESETS[localProviderId] ?? LOCAL_MODEL_PRESETS.custom;
}

function syncLocalModelFields(current: DesktopState, force = false) {
  if (!force && localModelFieldsDirty) return;

  localModelUrl = current.settings.modelUrl;
  localModelId = current.settings.modelId;
  localModelApiKey = current.settings.modelApiKey;
  localProviderId = providerForModelUrl(current.settings.modelUrl);
}

function syncRuntimeEnvironmentFields(current: DesktopState, force = false) {
  if (!force && runtimeEnvironmentDirty) return;
  environmentRows = rowsFromEnvironmentVariables(current.settings.environmentVariables);
}

function setLocalProvider(providerId: LocalModelProviderId) {
  const preset = LOCAL_MODEL_PRESETS[providerId];
  localProviderId = preset.id;
  if (providerId !== 'custom') {
    localModelUrl = preset.modelUrl;
    localModelId = preset.modelId;
    localModelApiKey = preset.modelApiKey;
  }
  localModelFieldsDirty = true;
  localModelProbe = undefined;
}

function currentModelMatchesSettings(current: DesktopState) {
  return (
    localModelUrl.trim() === current.settings.modelUrl &&
    localModelId.trim() === current.settings.modelId &&
    localModelApiKey.trim() === current.settings.modelApiKey
  );
}

async function runAction(action: string, task: () => Promise<DesktopState | void>) {
  busyAction = action;
  lastError = undefined;
  render();
  try {
    const nextState = await task();
    if (nextState) {
      state = nextState;
    }
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
  } finally {
    busyAction = undefined;
    render();
  }
}

function activeTab() {
  return state?.tabs.find(tab => tab.id === state?.activeTabId);
}

function tabKindLabel(tab: DesktopTab) {
  if (tab.kind === 'launcher') return '+';
  if (tab.kind === 'managed') return 'T';
  if (tab.kind === 'dev') return 'L';
  return 'P';
}

function renderTabs() {
  const current = state;
  if (!current) {
    tabStrip.innerHTML = '';
    return;
  }

  tabStrip.innerHTML = current.tabs
    .map(
      tab => `
        <button class="tab status-${tab.status} ${tab.id === current.activeTabId ? 'active' : ''}" type="button" data-tab-id="${tab.id}" aria-pressed="${tab.id === current.activeTabId}" ${tab.status === 'loading' ? 'aria-busy="true"' : ''}>
          <span class="tab-kind" aria-hidden="true">${tabKindLabel(tab)}</span>
          <span class="tab-title">${escapeHtml(tab.title)}</span>
          <span class="tab-close" data-close-tab-id="${tab.id}" title="Close tab" aria-hidden="true">×</span>
        </button>
      `,
    )
    .join('');
}

function renderStudioHost() {
  const current = state;
  if (!current) return;

  const active = activeTab();
  webviews.hidden = !active?.url || active.status === 'error';
}

function renderBootLoader() {
  const active = activeTab();
  bootLoader.hidden = !!state && (active?.kind === 'launcher' || active?.status === 'error' || !!active?.url);
}

function launcherActions(): LauncherActions {
  return {
    onApplyLocalModel: () => {
      void runAction('apply-local-model', async () => {
        if (!localModelUrl.trim()) throw new Error('Enter a model server base URL.');
        if (!localModelId.trim()) throw new Error('Enter or select a model ID.');

        await api.updateSettings({
          modelUrl: localModelUrl.trim(),
          modelId: localModelId.trim(),
          modelApiKey: localModelApiKey.trim() || 'not-needed',
        });
        localModelFieldsDirty = false;
        return api.restartRuntime();
      });
    },
    onAddEnvironmentPreset: key => {
      const hasKey = environmentRows.some(row => row.key.trim() === key);
      if (!hasKey) {
        environmentRows = [...environmentRows.filter(row => row.key.trim() || row.value), { key, value: '' }];
      }
      runtimeEnvironmentDirty = true;
      render();
    },
    onRuntimeEnvironmentRowsChange: rows => {
      environmentRows = rows.map(row => ({ key: row.key, value: row.value }));
      runtimeEnvironmentDirty = true;
      render();
    },
    onLocalModelApiKeyChange: value => {
      localModelApiKey = value;
      localModelFieldsDirty = true;
      render();
    },
    onLocalModelIdChange: value => {
      localModelId = value;
      localModelFieldsDirty = true;
      render();
    },
    onLocalModelUrlChange: value => {
      localModelUrl = value;
      localProviderId = providerForModelUrl(value);
      localModelFieldsDirty = true;
      localModelProbe = undefined;
      render();
    },
    onManualServerUrlChange: value => {
      manualServerUrl = value;
      render();
    },
    onOpenActiveExternal: () => {
      if (state?.activeTabId) {
        void runAction('open-active-external', () => api.openTabExternal(state!.activeTabId!));
      }
    },
    onOpenDefaultLocal: () => {
      void runAction('open-default-local', () => api.createDevTab({ serverUrl: state?.settings.devServerUrl || '4111' }));
    },
    onOpenManualLocal: () => {
      void runAction('open-manual-local', () => api.createDevTab({ serverUrl: manualServerUrl }));
    },
    onOpenPlatformProject: projectId => {
      void runAction(`platform-${projectId}`, () => api.createPlatformTab(projectId));
    },
    onOpenTemplate: () => {
      void runAction('open-template', () => api.createManagedTab());
    },
    onOpenSettings: () => {
      settingsOpen = true;
      render();
    },
    onPlatformBaseUrlChange: value => {
      platformBaseUrl = value;
      render();
    },
    onPlatformLogin: () => {
      void runAction('platform-login', () => api.startPlatformLogin());
    },
    onPlatformLogout: () => {
      void runAction('platform-logout', () => api.logoutPlatform());
    },
    onPlatformRefresh: () => {
      void runAction('platform-refresh', () => api.refreshPlatform());
    },
    onProbeLocalModels: () => {
      void runAction('probe-local-models', async () => {
        const provider = selectedLocalProvider();
        localModelProbe = await api.probeOpenAICompatibleModels(localModelUrl, provider.name, localModelApiKey);
        if (localModelProbe.ok && localModelProbe.models[0]) {
          localModelId = localModelProbe.models[0];
          localModelFieldsDirty = true;
        }
      });
    },
    onReloadActiveTab: () => {
      if (state?.activeTabId) {
        void runAction('reload-active-tab', () => api.reloadTab(state!.activeTabId!));
      }
    },
    onSavePlatformBase: () => {
      void runAction('save-platform-base', () =>
        api.updateSettings({ platformBaseUrl: platformBaseUrl.trim() || state?.settings.platformBaseUrl }).then(result => result.state),
      );
    },
    onSaveRuntimeEnvironment: rows => {
      void runAction('save-runtime-env', async () => {
        const environmentVariables = collectEnvironmentVariables(rows);
        await api.updateSettings({ environmentVariables });
        runtimeEnvironmentDirty = false;
        return api.restartRuntime();
      });
    },
    onSelectLocalModel: modelId => {
      localModelId = modelId;
      localModelFieldsDirty = true;
      render();
    },
    onSetLocalProvider: providerId => {
      setLocalProvider(providerId);
      render();
    },
  };
}

function runtimeSettingsProps() {
  const current = state;
  if (!current) return undefined;

  return {
    actions: launcherActions(),
    busyAction,
    current,
    environmentRows,
    isLocalModelApplied: currentModelMatchesSettings(current),
    localModelApiKey,
    localModelId,
    localModelProbe,
    localModelUrl,
    localProviderId,
    runtimeEnvironmentDirty,
  };
}

function renderLauncher() {
  const current = state;
  const active = activeTab();
  const showLauncher = !active || active.kind === 'launcher' || !active.url || active.status === 'error';
  launcher.hidden = !showLauncher;

  if (!current || !showLauncher) {
    launcherRoot.render(null);
    return;
  }

  launcherRoot.render(
    <Launcher
      actions={launcherActions()}
      activeTab={active}
      busyAction={busyAction}
      current={current}
      environmentRows={environmentRows}
      isLocalModelApplied={currentModelMatchesSettings(current)}
      lastError={lastError}
      localModelApiKey={localModelApiKey}
      localModelId={localModelId}
      localModelProbe={localModelProbe}
      localModelUrl={localModelUrl}
      localProviderId={localProviderId}
      manualServerUrl={manualServerUrl}
      platformBaseUrl={platformBaseUrl}
      runtimeEnvironmentDirty={runtimeEnvironmentDirty}
    />,
  );
}

function renderSettingsPanel() {
  const props = runtimeSettingsProps();

  settingsRoot.render(
    props ? (
      <SettingsPanel
        {...props}
        open={settingsOpen}
        onClose={() => {
          settingsOpen = false;
          render();
        }}
      />
    ) : null,
  );
}

function render() {
  renderTabs();
  renderStudioHost();
  renderLauncher();
  renderSettingsPanel();
  renderBootLoader();
}

tabStrip.addEventListener('click', event => {
  const target = event.target as HTMLElement;
  const closeTabId = target.dataset.closeTabId;
  if (closeTabId) {
    event.stopPropagation();
    void runAction(`close-${closeTabId}`, () => api.closeTab(closeTabId));
    return;
  }

  const tabButton = target.closest<HTMLButtonElement>('[data-tab-id]');
  if (tabButton?.dataset.tabId) {
    void runAction(`activate-${tabButton.dataset.tabId}`, () => api.activateTab(tabButton.dataset.tabId!));
  }
});

newTabButton.addEventListener('click', () => {
  void runAction('new-tab', () => api.createLauncherTab());
});

settingsButton.addEventListener('click', () => {
  settingsOpen = true;
  render();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && settingsOpen) {
    settingsOpen = false;
    render();
  }
});

void api.getState().then(initialState => {
  state = initialState;
  manualServerUrl = initialState.settings.devServerUrl;
  platformBaseUrl = initialState.settings.platformBaseUrl;
  syncLocalModelFields(initialState, true);
  syncRuntimeEnvironmentFields(initialState, true);
  render();
});

api.onStateChanged(nextState => {
  state = nextState;
  syncLocalModelFields(nextState);
  syncRuntimeEnvironmentFields(nextState);
  render();
});
