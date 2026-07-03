import '@mastra/playground-ui/style.css';
import './styles.css';

import { BrandLoader } from '@mastra/playground-ui/components/BrandLoader';
import { Button } from '@mastra/playground-ui/components/Button';
import { ThemeProvider } from '@mastra/playground-ui/components/ThemeProvider';
import { createRoot } from 'react-dom/client';

import type { DesktopState, MastraDesktopApi } from '../shared/types';

import { Launcher } from './launcher';
import type { LauncherActions } from './launcher';

declare global {
  interface Window {
    mastraDesktop: MastraDesktopApi;
  }
}

const api = window.mastraDesktop;
const tabStrip = document.querySelector<HTMLDivElement>('#tab-strip');
const launcher = document.querySelector<HTMLElement>('#launcher');
const webviews = document.querySelector<HTMLElement>('#webviews');
const bootLoader = document.querySelector<HTMLElement>('#boot-loader');

if (!tabStrip || !launcher || !webviews || !bootLoader) {
  throw new Error('Mastra Studio shell failed to mount');
}

const launcherRoot = createRoot(launcher);
const bootLoaderRoot = createRoot(bootLoader);
const tabsRoot = createRoot(tabStrip);

bootLoaderRoot.render(<BrandLoader aria-label="Loading Mastra Studio" size="lg" />);

let state: DesktopState | undefined;
let manualServerUrl = '4111';
let platformBaseUrl = '';
let busyAction: string | undefined;
let lastError: string | undefined;

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

function Tabs({ current }: { current: DesktopState }) {
  return (
    <>
      {current.tabs.map(tab => {
        const isActive = tab.id === current.activeTabId;

        return (
          <span className={`tab-shell ${isActive ? 'active' : ''}`} key={tab.id}>
            <Button
              aria-busy={tab.status === 'loading' ? true : undefined}
              aria-pressed={isActive}
              className={`tab-button status-${tab.status}`}
              onClick={() => void runAction(`activate-${tab.id}`, () => api.activateTab(tab.id))}
              size="sm"
              type="button"
              variant={isActive ? 'primary' : 'ghost'}
            >
              <span className="tab-title">{tab.title}</span>
            </Button>
            <Button
              aria-label={`Close ${tab.title}`}
              className="tab-close-button"
              onClick={event => {
                event.stopPropagation();
                void runAction(`close-${tab.id}`, () => api.closeTab(tab.id));
              }}
              size="xs"
              type="button"
              variant="ghost"
            >
              ×
            </Button>
          </span>
        );
      })}
      <Button
        aria-label="New tab"
        className="new-tab-button"
        onClick={() => void runAction('new-tab', () => api.createLauncherTab())}
        size="sm"
        title="New tab"
        type="button"
        variant="ghost"
      >
        +
      </Button>
    </>
  );
}

function renderTabs() {
  const current = state;
  if (!current) {
    tabsRoot.render(null);
    return;
  }

  tabsRoot.render(
    <ThemeProvider defaultTheme="system">
      <Tabs current={current} />
    </ThemeProvider>,
  );
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
    onCreateAgent: () => {
      void runAction('create-agent', () => api.createManagedTab({ route: '/agent-builder/agents/create' }));
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
