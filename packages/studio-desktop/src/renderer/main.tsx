import '@mastra/playground-ui/style.css';
import './styles.css';

import { BrandLoader } from '@mastra/playground-ui/components/BrandLoader';
import { createRoot } from 'react-dom/client';

import type { DesktopState, DesktopTab, MastraDesktopApi } from '../shared/types';

import { Launcher } from './launcher';
import type { LauncherActions } from './launcher';

declare global {
  interface Window {
    mastraDesktop: MastraDesktopApi;
  }
}

const api = window.mastraDesktop;
const tabStrip = document.querySelector<HTMLDivElement>('#tab-strip');
const newTabButton = document.querySelector<HTMLButtonElement>('#new-tab-button');
const launcher = document.querySelector<HTMLElement>('#launcher');
const webviews = document.querySelector<HTMLElement>('#webviews');
const bootLoader = document.querySelector<HTMLElement>('#boot-loader');

if (!tabStrip || !newTabButton || !launcher || !webviews || !bootLoader) {
  throw new Error('Mastra Studio shell failed to mount');
}

const launcherRoot = createRoot(launcher);
const bootLoaderRoot = createRoot(bootLoader);

bootLoaderRoot.render(<BrandLoader aria-label="Loading Mastra Studio" size="lg" />);

let state: DesktopState | undefined;
let manualServerUrl = '4111';
let platformBaseUrl = '';
let busyAction: string | undefined;
let lastError: string | undefined;

function escapeHtml(value: string | undefined) {
  return (value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
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
      void runAction('open-default-local', () =>
        api.createDevTab({ serverUrl: state?.settings.devServerUrl || '4111' }),
      );
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
      void runAction('open-settings', () => api.openSettingsTab());
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
    onReloadActiveTab: () => {
      if (state?.activeTabId) {
        void runAction('reload-active-tab', () => api.reloadTab(state!.activeTabId!));
      }
    },
    onSavePlatformBase: () => {
      void runAction('save-platform-base', () =>
        api
          .updateSettings({ platformBaseUrl: platformBaseUrl.trim() || state?.settings.platformBaseUrl })
          .then(result => result.state),
      );
    },
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
      lastError={lastError}
      manualServerUrl={manualServerUrl}
      platformBaseUrl={platformBaseUrl}
    />,
  );
}

function render() {
  renderTabs();
  renderStudioHost();
  renderLauncher();
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

void api.getState().then(initialState => {
  state = initialState;
  manualServerUrl = initialState.settings.devServerUrl;
  platformBaseUrl = initialState.settings.platformBaseUrl;
  render();
});

api.onStateChanged(nextState => {
  state = nextState;
  render();
});
