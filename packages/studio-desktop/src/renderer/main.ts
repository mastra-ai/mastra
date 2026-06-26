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

if (!tabStrip || !newTabButton || !launcher || !webviews) {
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
