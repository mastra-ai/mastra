import { LOCAL_MODEL_PRESETS } from '../shared/model-presets';
import type { LocalModelProviderId } from '../shared/model-presets';
import type { DesktopState, DesktopTab, MastraDesktopApi, PlatformProject, ProbeModelsResult } from '../shared/types';

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

let state: DesktopState | undefined;
let manualServerUrl = '4111';
let platformBaseUrl = '';
let localProviderId: LocalModelProviderId = 'lmstudio';
let localModelUrl = '';
let localModelId = '';
let localModelApiKey = '';
let localModelFieldsDirty = false;
let localModelProbe: ProbeModelsResult | undefined;
let busyAction: string | undefined;
let lastError: string | undefined;

function escapeHtml(value: string | undefined) {
  return (value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderMastraMark() {
  return `
    <svg viewBox="0 0 34 21" role="img" aria-label="Mastra">
      <path d="M4.49805 11.6934C6.98237 11.6934 8.99609 13.7081 8.99609 16.1924C8.9959 18.6765 6.98225 20.6904 4.49805 20.6904C2.01394 20.6903 0.000196352 18.6765 0 16.1924C0 13.7081 2.01382 11.6935 4.49805 11.6934ZM10.3867 0C12.8709 0 14.8846 2.01388 14.8848 4.49805C14.8848 4.8377 14.847 5.16846 14.7755 5.48643C14.4618 6.88139 14.1953 8.4633 14.9928 9.65L16.2575 11.5319C16.3363 11.6491 16.4727 11.7115 16.6137 11.703C16.7369 11.6957 16.8525 11.6343 16.9214 11.5318L18.1876 9.64717C18.9772 8.47198 18.7236 6.90783 18.4205 5.52484C18.3523 5.21392 18.3164 4.89094 18.3164 4.55957C18.3167 2.07546 20.3313 0.0615234 22.8154 0.0615234C25.2994 0.0617476 27.3132 2.0756 27.3135 4.55957C27.3135 4.93883 27.2665 5.30712 27.178 5.65896C26.8547 6.94441 26.5817 8.37932 27.2446 9.52714L28.459 11.6301C28.4819 11.6697 28.5245 11.6934 28.5703 11.6934C31.0545 11.6935 33.0684 13.7081 33.0684 16.1924C33.0682 18.6765 31.0544 20.6903 28.5703 20.6904C26.0861 20.6904 24.0725 18.6765 24.0723 16.1924C24.0723 15.8049 24.1212 15.4288 24.2133 15.0701C24.5458 13.7746 24.8298 12.3251 24.1609 11.1668L23.0044 9.16384C22.9656 9.09659 22.8931 9.05859 22.8154 9.05859C22.7983 9.05859 22.7824 9.06614 22.7728 9.08033L21.4896 10.9895C20.686 12.1851 20.9622 13.781 21.284 15.1851C21.3582 15.5089 21.3975 15.8461 21.3975 16.1924C21.3973 18.6764 19.3834 20.6902 16.8994 20.6904C14.4152 20.6904 12.4006 18.6765 12.4004 16.1924C12.4004 15.932 12.4226 15.6768 12.4651 15.4286C12.6859 14.14 12.8459 12.7122 12.1167 11.6271L11.2419 10.3253C10.6829 9.49347 9.71913 9.05932 8.78286 8.70188C7.0906 8.05584 5.88867 6.41734 5.88867 4.49805C5.88886 2.0139 7.90254 3.29835e-05 10.3867 0Z" />
    </svg>
  `;
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

  return (
    rows ||
    `<div class="empty-row">
      <span>No hosted Studio is available for this organization.</span>
    </div>`
  );
}

function renderDetectedModels() {
  if (!localModelProbe) return '';

  if (!localModelProbe.ok) {
    return `<div class="error-banner">${escapeHtml(localModelProbe.error ?? 'Unable to reach the model server.')}</div>`;
  }

  if (localModelProbe.models.length === 0) {
    return `<div class="info-banner">Server reachable, but no loaded models were reported.</div>`;
  }

  return `
    <div class="model-list">
      ${localModelProbe.models
        .map(
          model => `
            <button class="model-choice ${model === localModelId ? 'active' : ''}" type="button" data-model-id="${escapeHtml(model)}">
              ${escapeHtml(model)}
            </button>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderLocalSetup(current: DesktopState) {
  const selectedProvider = selectedLocalProvider();
  const isApplied = currentModelMatchesSettings(current);
  const runtimeLabel =
    current.runtime.state === 'running'
      ? `Runtime running on ${current.runtime.url ?? 'local port'}`
      : `Runtime ${current.runtime.state}`;

  return `
    <div class="section-heading">
      <span>Local Model Setup</span>
      <span class="section-status">${escapeHtml(runtimeLabel)}</span>
    </div>
    <div class="local-setup">
      <div class="provider-tabs" role="group" aria-label="Local model provider">
        ${Object.values(LOCAL_MODEL_PRESETS)
          .map(
            provider => `
              <button class="${provider.id === localProviderId ? 'active' : ''}" type="button" data-provider-id="${provider.id}">
                ${escapeHtml(provider.name)}
              </button>
            `,
          )
          .join('')}
      </div>
      <div class="setup-guidance">${escapeHtml(selectedProvider.guidance)}</div>
      <div class="setup-grid">
        <label>
          <span>Base URL</span>
          <input id="local-model-url" value="${escapeHtml(localModelUrl)}" placeholder="http://localhost:1234/v1" />
        </label>
        <label>
          <span>Model ID</span>
          <input id="local-model-id" value="${escapeHtml(localModelId)}" placeholder="Loaded model ID" />
        </label>
        <label>
          <span>API key</span>
          <input id="local-model-api-key" value="${escapeHtml(localModelApiKey)}" placeholder="not-needed" />
        </label>
      </div>
      ${renderDetectedModels()}
      <div class="setup-actions">
        <button type="button" data-action="probe-local-models">${busyAction === 'probe-local-models' ? 'Probing...' : 'Probe models'}</button>
        <button type="button" data-action="apply-local-model">${busyAction === 'apply-local-model' ? 'Applying...' : isApplied ? 'Restart runtime' : 'Apply & restart'}</button>
      </div>
    </div>
  `;
}

function renderLocalRows(current: DesktopState) {
  return `
    <button class="launcher-row hero-row" type="button" data-action="open-template">
      <span class="row-icon">T</span>
      <span class="row-main">
        <span class="row-title">Bundled Template</span>
        <span class="row-subtitle">Local starter runtime with the default desktop assistant</span>
      </span>
      <span class="row-action">Open</span>
    </button>

    ${renderLocalSetup(current)}

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
    <div class="launcher-shell">
      <div class="launcher-hero">
        <div class="brand-lockup">
          <span class="brand-mark">${renderMastraMark()}</span>
          <span>Mastra Studio</span>
        </div>
        <p>Choose a local runtime or open a hosted Studio.</p>
      </div>

      <div class="launcher-columns">
        <section class="source-panel local-source" aria-label="Local Studio">
          <div class="source-header">
            <span class="source-kicker">Local</span>
            <h2>Studio on this Mac</h2>
            <p>Bundled template, local models, or a running Mastra dev server.</p>
          </div>
          <div class="source-list">
            ${renderLocalRows(current)}
          </div>
        </section>

        <section class="source-panel platform-source" aria-label="Platform Studios">
          <div class="source-header">
            <span class="source-kicker">Platform</span>
            <h2>Hosted Studios</h2>
            <p>Studios attached to your Mastra Platform account.</p>
          </div>
          <div class="source-list">
            <div class="section-heading platform-heading">
              <span>${current.platform.signedIn ? 'Platform Studios' : 'Mastra Platform'}</span>
              ${
                current.platform.signedIn
                  ? `<button type="button" data-action="platform-refresh">${busyAction === 'platform-refresh' ? 'Refreshing...' : 'Refresh'}</button>
                     <button type="button" data-action="platform-logout">Sign out</button>`
                  : ''
              }
            </div>
            ${platformStatus}
            ${lastError ? `<div class="error-banner">${escapeHtml(lastError)}</div>` : ''}
            ${renderPlatformRows(current)}
          </div>
        </section>
      </div>
    </div>
  `;

  launcher.querySelector<HTMLInputElement>('#manual-server-url')?.addEventListener('input', event => {
    manualServerUrl = (event.target as HTMLInputElement).value;
  });
  launcher.querySelector<HTMLInputElement>('#platform-base-url')?.addEventListener('input', event => {
    platformBaseUrl = (event.target as HTMLInputElement).value;
  });
  launcher.querySelector<HTMLInputElement>('#local-model-url')?.addEventListener('input', event => {
    localModelUrl = (event.target as HTMLInputElement).value;
    localProviderId = providerForModelUrl(localModelUrl);
    localModelFieldsDirty = true;
    localModelProbe = undefined;
  });
  launcher.querySelector<HTMLInputElement>('#local-model-id')?.addEventListener('input', event => {
    localModelId = (event.target as HTMLInputElement).value;
    localModelFieldsDirty = true;
  });
  launcher.querySelector<HTMLInputElement>('#local-model-api-key')?.addEventListener('input', event => {
    localModelApiKey = (event.target as HTMLInputElement).value;
    localModelFieldsDirty = true;
  });
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

launcher.addEventListener('click', event => {
  const target = event.target as HTMLElement;
  const actionButton = target.closest<HTMLButtonElement>('[data-action]');
  const projectButton = target.closest<HTMLButtonElement>('[data-platform-project-id]');
  const providerButton = target.closest<HTMLButtonElement>('[data-provider-id]');
  const modelButton = target.closest<HTMLButtonElement>('[data-model-id]');

  if (projectButton?.dataset.platformProjectId) {
    void runAction(`platform-${projectButton.dataset.platformProjectId}`, () =>
      api.createPlatformTab(projectButton.dataset.platformProjectId!),
    );
    return;
  }

  const providerId = providerButton?.dataset.providerId as LocalModelProviderId | undefined;
  if (providerId && providerId in LOCAL_MODEL_PRESETS) {
    setLocalProvider(providerId);
    render();
    return;
  }

  if (modelButton?.dataset.modelId) {
    localModelId = modelButton.dataset.modelId;
    localModelFieldsDirty = true;
    render();
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
  } else if (action === 'probe-local-models') {
    void runAction(action, async () => {
      const provider = selectedLocalProvider();
      localModelProbe = await api.probeOpenAICompatibleModels(localModelUrl, provider.name);
      if (localModelProbe.ok && localModelProbe.models[0]) {
        localModelId = localModelProbe.models[0]!;
        localModelFieldsDirty = true;
      }
    });
  } else if (action === 'apply-local-model') {
    void runAction(action, async () => {
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
  }
});

void api.getState().then(initialState => {
  state = initialState;
  manualServerUrl = initialState.settings.devServerUrl;
  platformBaseUrl = initialState.settings.platformBaseUrl;
  syncLocalModelFields(initialState, true);
  render();
});

api.onStateChanged(nextState => {
  state = nextState;
  syncLocalModelFields(nextState);
  render();
});
