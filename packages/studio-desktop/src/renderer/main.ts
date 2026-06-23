import type { DesktopState, DesktopTab, MastraDesktopApi, PlatformProject } from '../shared/types';

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

if (!tabStrip || !newTabButton || !launcher || !webviews) {
  throw new Error('Mastra Studio shell failed to mount');
}

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

function canOpenHostedStudio(project: PlatformProject) {
  return !!project.instanceUrl;
}

function isHealthyHostedStudioStatus(project: PlatformProject) {
  return ['running', 'sleeping', 'stopped'].includes(project.latestDeployStatus ?? '');
}

function statusTone(project: PlatformProject) {
  if (!project.instanceUrl) return 'muted';
  if (isHealthyHostedStudioStatus(project)) return 'live';
  if (project.latestDeployStatus === 'failed') return 'warning';
  return 'muted';
}

function projectStatus(project: PlatformProject) {
  if (!project.instanceUrl) return 'No Studio URL';
  return project.latestDeployStatus ?? 'unknown';
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
        <button class="tab ${tab.id === current.activeTabId ? 'active' : ''}" type="button" data-tab-id="${tab.id}" aria-pressed="${tab.id === current.activeTabId}">
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

function renderPlatformRows(current: DesktopState) {
  if (!current.platform.signedIn) {
    return `
      <button class="launcher-row" type="button" data-action="platform-login">
        <span class="row-icon">P</span>
        <span class="row-main">
          <span class="row-title">Sign in to Mastra</span>
          <span class="row-subtitle">List hosted Studio projects from your Platform account</span>
        </span>
        <span class="row-action">${busyAction === 'platform-login' ? 'Opening...' : 'Connect'}</span>
      </button>
      <div class="inline-config">
        <label for="platform-base-url">Platform API URL</label>
        <input id="platform-base-url" value="${escapeHtml(platformBaseUrl || current.settings.platformBaseUrl)}" />
        <button type="button" data-action="save-platform-base">Set</button>
      </div>
    `;
  }

  const rows = current.platform.projects
    .filter(project => project.studioEnabled || project.instanceUrl)
    .map(project => {
      const disabled = !canOpenHostedStudio(project);
      return `
        <button class="launcher-row" type="button" data-platform-project-id="${project.id}" ${disabled ? 'disabled' : ''}>
          <span class="row-icon">P</span>
          <span class="row-main">
            <span class="row-title">${escapeHtml(project.name)}</span>
            <span class="row-subtitle">${escapeHtml(project.instanceUrl ?? project.slug)}</span>
          </span>
          <span class="status-pill ${statusTone(project)}">${escapeHtml(projectStatus(project))}</span>
        </button>
      `;
    })
    .join('');

  return `
    <div class="section-heading">
      <span>Platform Studios</span>
      <button type="button" data-action="platform-refresh">${busyAction === 'platform-refresh' ? 'Refreshing...' : 'Refresh'}</button>
      <button type="button" data-action="platform-logout">Sign out</button>
    </div>
    ${
      rows ||
      `<div class="empty-row">
        <span>No hosted Studio is available for this organization.</span>
      </div>`
    }
  `;
}

function renderLauncher() {
  const current = state;
  const active = activeTab();
  const showLauncher = !active || active.kind === 'launcher' || !active.url || active.status === 'error';
  launcher.hidden = !showLauncher;
  if (!current || !showLauncher) return;

  if (active?.status === 'error') {
    launcher.innerHTML = `
      <div class="launcher-panel">
        <div class="launcher-list">
          <div class="studio-error">
            <span class="row-icon error-icon">!</span>
            <span class="row-main">
              <span class="row-title">Studio failed to load</span>
              <span class="row-subtitle">${escapeHtml(active.error ?? 'The Studio tab could not be loaded.')}</span>
              ${active.url ? `<span class="error-url">${escapeHtml(active.url)}</span>` : ''}
            </span>
            <span class="error-actions">
              <button type="button" data-action="reload-active-tab">Reload</button>
              <button type="button" data-action="open-active-external">Open in browser</button>
            </span>
          </div>
        </div>
      </div>
    `;
    return;
  }

  const platformStatus =
    current.platform.status === 'error'
      ? `<div class="error-banner">${escapeHtml(current.platform.error)}</div>`
      : current.platform.status === 'loading' || current.platform.status === 'signing-in'
        ? `<div class="info-banner">${current.platform.status === 'signing-in' ? 'Waiting for browser sign-in...' : 'Loading Platform projects...'}</div>`
        : '';

  launcher.innerHTML = `
    <div class="launcher-panel">
      <div class="launcher-list">
        <button class="launcher-row" type="button" data-action="open-template">
          <span class="row-icon">T</span>
          <span class="row-main">
            <span class="row-title">Bundled Template</span>
            <span class="row-subtitle">Local starter runtime with the default desktop assistant</span>
          </span>
          <span class="row-action">Open</span>
        </button>

        <button class="launcher-row" type="button" data-action="open-default-local">
          <span class="row-icon">L</span>
          <span class="row-main">
            <span class="row-title">Localhost :4111</span>
            <span class="row-subtitle">Connect to a running mastra dev server</span>
          </span>
          <span class="row-action">Probe</span>
        </button>

        <div class="manual-row">
          <span class="row-icon">L</span>
          <label class="manual-field">
            <span>Connect local server</span>
            <input id="manual-server-url" value="${escapeHtml(manualServerUrl)}" placeholder="4111 or http://127.0.0.1:4111" />
          </label>
          <button type="button" data-action="open-manual-local">${busyAction === 'open-manual-local' ? 'Opening...' : 'Open'}</button>
        </div>

        ${platformStatus}
        ${lastError ? `<div class="error-banner">${escapeHtml(lastError)}</div>` : ''}
        ${renderPlatformRows(current)}
      </div>
    </div>
  `;

  launcher.querySelector<HTMLInputElement>('#manual-server-url')?.addEventListener('input', event => {
    manualServerUrl = (event.target as HTMLInputElement).value;
  });
  launcher.querySelector<HTMLInputElement>('#platform-base-url')?.addEventListener('input', event => {
    platformBaseUrl = (event.target as HTMLInputElement).value;
  });
}

function render() {
  renderTabs();
  renderStudioHost();
  renderLauncher();
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

launcher.addEventListener('click', event => {
  const target = event.target as HTMLElement;
  const actionButton = target.closest<HTMLButtonElement>('[data-action]');
  const projectButton = target.closest<HTMLButtonElement>('[data-platform-project-id]');

  if (projectButton?.dataset.platformProjectId) {
    void runAction(`platform-${projectButton.dataset.platformProjectId}`, () =>
      api.createPlatformTab(projectButton.dataset.platformProjectId!),
    );
    return;
  }

  const action = actionButton?.dataset.action;
  if (!action) return;

  if (action === 'open-template') {
    void runAction(action, () => api.createManagedTab());
  } else if (action === 'open-default-local') {
    void runAction(action, () => api.createDevTab({ serverUrl: state?.settings.devServerUrl || '4111' }));
  } else if (action === 'open-manual-local') {
    void runAction(action, () => api.createDevTab({ serverUrl: manualServerUrl }));
  } else if (action === 'platform-login') {
    void runAction(action, () => api.startPlatformLogin());
  } else if (action === 'platform-refresh') {
    void runAction(action, () => api.refreshPlatform());
  } else if (action === 'platform-logout') {
    void runAction(action, () => api.logoutPlatform());
  } else if (action === 'save-platform-base') {
    void runAction(action, () => api.updateSettings({ platformBaseUrl }).then(result => result.state));
  } else if (action === 'reload-active-tab' && state?.activeTabId) {
    void runAction(action, () => api.reloadTab(state.activeTabId!));
  } else if (action === 'open-active-external' && state?.activeTabId) {
    void runAction(action, () => api.openTabExternal(state.activeTabId!));
  }
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
