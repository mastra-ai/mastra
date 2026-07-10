import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import electron from 'electron';
import type { BrowserWindow } from 'electron';

const E2E_RESULT_FILE_ENV = 'MASTRACODE_DESKTOP_E2E_RESULT_FILE';
const E2E_PROGRESS_FILE_ENV = 'MASTRACODE_DESKTOP_E2E_PROGRESS_FILE';
const E2E_REQUIRE_AUTHED_MODELS_ENV = 'MASTRACODE_DESKTOP_E2E_REQUIRE_AUTHED_MODELS';
const E2E_LIVE_CHAT_ENV = 'MASTRACODE_DESKTOP_E2E_LIVE_CHAT';
const E2E_LIVE_CHAT_MODEL_ENV = 'MASTRACODE_DESKTOP_E2E_LIVE_CHAT_MODEL';
const E2E_LIVE_WEB_ENV = 'MASTRACODE_DESKTOP_E2E_LIVE_WEB';
const { app } = electron;
let progressWriteQueue: Promise<void> = Promise.resolve();

export function readDesktopE2EOption(envName: string, argName: string): string | undefined {
  const envValue = process.env[envName];
  if (envValue) return envValue;

  const prefix = `--${argName}=`;
  const arg = process.argv.find(value => value.startsWith(prefix));
  return arg?.slice(prefix.length);
}

function readDesktopE2EBooleanOption(envName: string, argName: string): boolean {
  const value = readDesktopE2EOption(envName, argName);
  return value === '1' || value === 'true';
}

function isLoopbackOrigin(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' && url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

interface E2EResult {
  ok: boolean;
  details?: unknown;
  error?: {
    message: string;
    stack?: string;
  };
}

function serializeError(error: unknown): E2EResult['error'] {
  if (error instanceof Error) return { message: error.message, stack: error.stack };
  return { message: String(error) };
}

async function writeResult(resultFile: string, result: E2EResult): Promise<void> {
  await mkdir(dirname(resultFile), { recursive: true });
  await writeFile(resultFile, `${JSON.stringify(result, null, 2)}\n`, 'utf-8');
}

export async function writeDesktopE2EProgress(stage: string, details?: unknown): Promise<void> {
  const progressFile = readDesktopE2EOption(E2E_PROGRESS_FILE_ENV, 'mastracode-desktop-e2e-progress-file');
  if (!progressFile) return;
  const payload = `${JSON.stringify({ stage, details, timestamp: new Date().toISOString() }, null, 2)}\n`;
  const write = progressWriteQueue.then(async () => {
    await mkdir(dirname(progressFile), { recursive: true });
    await writeFile(progressFile, payload, { encoding: 'utf-8' });
  });
  progressWriteQueue = write.catch(() => undefined);
  return write;
}

export async function writeDesktopE2EFailure(error: unknown): Promise<void> {
  const resultFile = readDesktopE2EOption(E2E_RESULT_FILE_ENV, 'mastracode-desktop-e2e-result-file');
  if (!resultFile) return;
  const serialized = serializeError(error);
  await writeResult(resultFile, { ok: false, error: serialized });
  await writeDesktopE2EProgress('desktop-e2e-failed-before-renderer', serialized);
}

async function runRendererStep(
  window: BrowserWindow,
  label: string,
  script: string,
  timeoutMs = 10_000,
): Promise<unknown> {
  const execution = window.webContents.executeJavaScript(script, true) as Promise<unknown>;
  const timeout = delay(timeoutMs).then(() => {
    throw new Error(`Timed out during installed desktop E2E step: ${label}`);
  });
  return Promise.race([execution, timeout]);
}

function waitForOpenProjectScreenScript(): string {
  return `
    (async () => {
      const waitFor = async (read, label, timeoutMs = 30000) => {
        const started = Date.now();
        let lastValue;
        while (Date.now() - started < timeoutMs) {
          lastValue = read();
          if (lastValue) return lastValue;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error('Timed out waiting for ' + label + ': ' + String(lastValue));
      };
      return waitFor(() => document.body.innerText.includes('Open a project'), 'open project screen');
    })();
  `;
}

function clickChooseFromFinderScript(): string {
  return `
    (async () => {
      const waitFor = async (read, label, timeoutMs = 30000) => {
        const started = Date.now();
        let lastValue;
        while (Date.now() - started < timeoutMs) {
          lastValue = read();
          if (lastValue) return lastValue;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error('Timed out waiting for ' + label + ': ' + String(lastValue));
      };
      const findButton = label => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(button => label.test(button.textContent || '')) || null;
      };
      const chooseButton = await waitFor(() => findButton(/Choose from Finder/i), 'Choose from Finder button');
      chooseButton.click();
      return true;
    })();
  `;
}

function selectedProjectScript(expectedProjectPath: string | undefined): string {
  return `
    (async () => {
      const expectedProjectPath = ${JSON.stringify(expectedProjectPath ?? null)};
      const waitFor = async (read, label, timeoutMs = 30000) => {
        const started = Date.now();
        let lastValue;
        while (Date.now() - started < timeoutMs) {
          lastValue = read();
          if (lastValue) return lastValue;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error('Timed out waiting for ' + label + ': ' + String(lastValue));
      };
      const selectedProject = await waitFor(() => {
        const raw = window.localStorage.getItem('mastracode-projects');
        if (!raw) return null;
        const projects = JSON.parse(raw);
        if (!Array.isArray(projects)) return null;
        return projects.find(project => {
          if (!project || typeof project !== 'object') return false;
          if (expectedProjectPath && project.path !== expectedProjectPath) return false;
          return typeof project.name === 'string' && typeof project.path === 'string';
        }) || null;
      }, 'persisted selected project');
      return selectedProject;
    })();
  `;
}

function claudeOAuthStartScript(): string {
  return `
    (async () => {
      const oauthResponse = await fetch('/web/config/providers/anthropic/oauth/start', { method: 'POST' });
      const oauthBody = await oauthResponse.json();
      if (!oauthResponse.ok) {
        throw new Error('Claude OAuth start failed: ' + JSON.stringify(oauthBody));
      }
      if (!oauthBody || typeof oauthBody.loginId !== 'string' || typeof oauthBody.authUrl !== 'string') {
        throw new Error('Claude OAuth start returned an invalid body');
      }
      const oauthUrl = new URL(oauthBody.authUrl);

      return {
        loginIdLength: oauthBody.loginId.length,
        authUrlHost: oauthUrl.host,
        authUrlPath: oauthUrl.pathname,
      };
    })();
  `;
}

function modelCatalogScript(requireAuthedModels: boolean): string {
  return `
    (async () => {
      const requireAuthedModels = ${JSON.stringify(requireAuthedModels)};
      const response = await fetch('/api/agent-controller/code/models');
      const body = await response.json();
      if (!response.ok) {
        throw new Error('Model catalog failed: ' + JSON.stringify(body));
      }
      const models = Array.isArray(body.models) ? body.models : [];
      const authed = models.filter(model => model && model.hasApiKey === true);
      const providers = {};
      for (const model of models) {
        if (!model || typeof model.provider !== 'string') continue;
        providers[model.provider] ??= { total: 0, authed: 0 };
        providers[model.provider].total += 1;
        if (model.hasApiKey === true) providers[model.provider].authed += 1;
      }

      const claude = authed
        .filter(model => model.provider === 'anthropic' || model.provider === 'mastracode/anthropic')
        .map(model => model.id)
        .filter(id => typeof id === 'string')
        .slice(0, 5);
      const codex = authed
        .filter(model => {
          if (model.provider !== 'openai' && model.provider !== 'mastracode/openai') return false;
          const id = String(model.id || '');
          const modelName = String(model.modelName || '');
          return /codex|gpt-5/i.test(id) || /codex|gpt-5/i.test(modelName);
        })
        .map(model => model.id)
        .filter(id => typeof id === 'string')
        .slice(0, 5);

      if (requireAuthedModels) {
        if (claude.length === 0) {
          throw new Error('No authenticated Claude models were exposed by the desktop model catalog.');
        }
        if (codex.length === 0) {
          throw new Error('No authenticated OpenAI Codex models were exposed by the desktop model catalog.');
        }
      }

      return {
        total: models.length,
        authedTotal: authed.length,
        providers,
        claude,
        codex,
      };
    })();
  `;
}

function visibleProviderUiScript(requireAuthedModels: boolean): string {
  return `
    (async () => {
      const requireAuthedModels = ${JSON.stringify(requireAuthedModels)};
      const waitFor = async (read, label, timeoutMs = 30000) => {
        const started = Date.now();
        let lastValue;
        while (Date.now() - started < timeoutMs) {
          lastValue = read();
          if (lastValue) return lastValue;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error('Timed out waiting for ' + label + ': ' + String(lastValue));
      };
      const buttons = () => Array.from(document.querySelectorAll('button'));
      const buttonNamed = label => buttons().find(button => label.test((button.getAttribute('aria-label') || '') + ' ' + (button.textContent || '')));
      const closeSettings = async () => {
        const dialog = document.querySelector('[role="dialog"][aria-label="Settings"]');
        const close = dialog
          ? Array.from(dialog.querySelectorAll('button')).find(button => /close/i.test((button.getAttribute('aria-label') || '') + ' ' + (button.textContent || '')))
          : null;
        if (close) close.click();
        else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
        await waitFor(() => !document.querySelector('[role="dialog"][aria-label="Settings"]'), 'settings close');
      };

      (await waitFor(() => buttonNamed(/Open settings/i), 'Open settings button')).click();
      const settings = await waitFor(
        () => document.querySelector('[role="dialog"][aria-label="Settings"]'),
        'Settings dialog',
      );
      const modelTab = Array.from(settings.querySelectorAll('[role="tab"]')).find(tab => /^Model$/.test(tab.textContent || ''));
      if (!modelTab) throw new Error('Model settings tab is missing');
      modelTab.click();
      const modelButton = await waitFor(
        () => settings.querySelector('button[aria-haspopup="listbox"]'),
        'model selector',
      );
      modelButton.click();
      const search = await waitFor(
        () => settings.querySelector('input[aria-label="Search models"]'),
        'model search',
      );
      const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (!inputSetter) throw new Error('Cannot set the model search value');
      const findModel = async (name, pattern) => {
        inputSetter.call(search, name);
        search.dispatchEvent(new Event('input', { bubbles: true }));
        const option = await waitFor(
          () => Array.from(settings.querySelectorAll('[role="option"]')).find(value => pattern.test(value.textContent || '')),
          name + ' model option',
        );
        return { text: (option.textContent || '').trim(), enabled: !option.disabled };
      };
      const claude = await findModel('claude-code-sonnet', /claude-code-sonnet/i);
      const codex = await findModel('codex-cli', /codex-cli/i);
      if (requireAuthedModels && (!claude.enabled || !codex.enabled)) {
        throw new Error('Claude and Codex CLI models are visible but not authenticated');
      }
      await closeSettings();

      const composer = await waitFor(() => document.querySelector('textarea'), 'message composer');
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (!valueSetter) throw new Error('Cannot set the message composer value');
      valueSetter.call(composer, '/login');
      composer.dispatchEvent(new Event('input', { bubbles: true }));
      composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
      const providerSettings = await waitFor(
        () => document.querySelector('[role="dialog"][aria-label="Settings"]'),
        '/login provider settings',
      );
      const activeTab = providerSettings.querySelector('[role="tab"][aria-selected="true"]');
      if (!activeTab || !/Providers/.test(activeTab.textContent || '')) {
        throw new Error('/login did not open the Providers settings tab');
      }
      const claudeSubscription = await waitFor(
        () => Array.from(providerSettings.querySelectorAll('li')).find(row =>
          (row.textContent || '').includes('Claude Pro/Max'),
        ),
        'Claude Pro/Max subscription provider',
      );
      const subscriptionAction = await waitFor(
        () => Array.from(claudeSubscription.querySelectorAll('button')).find(button => /Sign (in|out)/.test(button.textContent || '')),
        'Claude Pro/Max subscription action',
      );
      await closeSettings();
      return {
        claude,
        codex,
        loginTab: (activeTab.textContent || '').trim(),
        subscriptionLogin: (claudeSubscription.textContent || '').trim(),
        subscriptionAction: (subscriptionAction.textContent || '').trim(),
      };
    })();
  `;
}

function liveChatScript(
  expectedProjectPath: string | undefined,
  requestedModelName: string | undefined,
  runLiveWeb: boolean,
): string {
  return `
    (async () => {
      const expectedProjectPath = ${JSON.stringify(expectedProjectPath ?? null)};
      const requestedModelName = ${JSON.stringify(requestedModelName ?? null)};
      const runLiveWeb = ${JSON.stringify(runLiveWeb)};
      const fetchJson = async (url, init) => {
        const response = await fetch(url, {
          ...init,
          headers: {
            'content-type': 'application/json',
            ...(init && init.headers ? init.headers : {}),
          },
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(url + ' failed: ' + JSON.stringify(body));
        }
        return body;
      };

      const modelBody = await fetchJson('/api/agent-controller/code/models');
      const authed = Array.isArray(modelBody.models) ? modelBody.models.filter(model => model?.hasApiKey === true) : [];
      const matchesRequestedModel = model => {
        if (!requestedModelName) return false;
        const id = String(model?.id ?? '');
        const modelName = String(model?.modelName ?? '');
        return id === requestedModelName || modelName === requestedModelName || id.endsWith('/' + requestedModelName);
      };
      const preferredModel = requestedModelName
        ? authed.find(matchesRequestedModel)
        : authed.find(model => model.modelName === 'codex-cli') ??
          authed.find(model => model.modelName === 'claude-code-sonnet') ??
          authed.find(model => model.provider === 'anthropic') ??
          authed.find(model => model.provider === 'openai' && /codex/i.test(String(model.id || model.modelName || ''))) ??
          authed.find(model => model.provider === 'openai' && /gpt-5/i.test(String(model.id || model.modelName || ''))) ??
          authed[0];
      const forcedModel = !preferredModel && requestedModelName && requestedModelName.includes('/')
        ? {
            id: requestedModelName,
            provider: requestedModelName.split('/')[0],
            modelName: requestedModelName.split('/').slice(1).join('/'),
          }
        : undefined;
      const selectedModel = preferredModel ?? forcedModel;
      if (!selectedModel || typeof selectedModel.id !== 'string') {
        throw new Error(
          requestedModelName
            ? 'Cannot run live chat E2E without authenticated model ' + requestedModelName + '.'
            : 'Cannot run live chat E2E without an authenticated model.',
        );
      }
      const modelLabel = String(selectedModel.provider || 'unknown') + '/' + selectedModel.id;

      const resourceId = 'desktop-e2e-' + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
      const createBody = {
        resourceId,
        ...(expectedProjectPath ? { tags: { projectPath: expectedProjectPath } } : {}),
      };
      const created = await fetchJson('/api/agent-controller/code/sessions', {
        method: 'POST',
        body: JSON.stringify(createBody),
      });
      if (!created.threadId || typeof created.threadId !== 'string') {
        throw new Error('Desktop live chat session did not create an active thread.');
      }

      if (expectedProjectPath) {
        await fetchJson('/api/agent-controller/code/sessions/' + encodeURIComponent(resourceId) + '/state', {
          method: 'PUT',
          body: JSON.stringify({ state: { projectPath: expectedProjectPath } }),
        });
      }

      await fetchJson('/api/agent-controller/code/sessions/' + encodeURIComponent(resourceId) + '/mode', {
        method: 'POST',
        body: JSON.stringify({ modeId: 'build' }),
      });

      await fetchJson('/api/agent-controller/code/sessions/' + encodeURIComponent(resourceId) + '/model', {
        method: 'POST',
        body: JSON.stringify({ modelId: selectedModel.id, scope: 'thread' }),
      });

      const streamUrl = '/api/agent-controller/code/sessions/' + encodeURIComponent(resourceId) + '/stream';
      const eventTypes = [];
      const toolNames = [];
      const assistantTextParts = [];
      let posted = false;
      const done = await new Promise((resolve, reject) => {
        const source = new EventSource(streamUrl);
        const timeout = setTimeout(() => {
          source.close();
          reject(new Error('Timed out waiting for live chat response from ' + modelLabel + '; events=' + JSON.stringify(eventTypes)));
        }, 90000);
        const finish = value => {
          clearTimeout(timeout);
          source.close();
          resolve(value);
        };
        const fail = error => {
          clearTimeout(timeout);
          source.close();
          reject(error);
        };
        source.onopen = () => {
          if (posted) return;
          posted = true;
          Promise.all(
            ['read', 'edit', 'execute', 'mcp', 'other'].map(category =>
              fetchJson('/api/agent-controller/code/sessions/' + encodeURIComponent(resourceId) + '/permissions/category', {
                method: 'PUT',
                body: JSON.stringify({ category, policy: 'allow' }),
              }),
            ),
          )
            .then(() =>
              fetchJson('/api/agent-controller/code/sessions/' + encodeURIComponent(resourceId) + '/messages', {
                method: 'POST',
                body: JSON.stringify({
                  message: runLiveWeb
                    ? 'Use web_fetch to retrieve https://api.github.com/repos/mastra-ai/mastra directly. Reply with exactly LIVE_FETCH_OK followed by one space and the numeric stargazers_count from the fetched JSON. Do not use web_search.'
                    : expectedProjectPath
                    ? 'Create a file named MASTRACODE_DESKTOP_E2E.txt in the project root with exactly DESKTOP_E2E_OK as its content, then confirm completion.'
                    : 'Reply with exactly OK and no punctuation.',
                }),
              }),
            )
            .catch(fail);
        };
        source.onerror = () => {
          if (!posted) fail(new Error('Live chat event stream failed before sending the test message.'));
        };
        source.onmessage = event => {
          if (!event.data) return;
          let payload;
          try {
            payload = JSON.parse(event.data);
          } catch {
            return;
          }
          if (!payload || typeof payload.type !== 'string') return;
          eventTypes.push(payload.type);
          if (payload.type === 'tool_start' && typeof payload.toolName === 'string') {
            toolNames.push(payload.toolName);
          }
          if (payload.type === 'message_update' || payload.type === 'message_end') {
            const content = Array.isArray(payload.message?.content) ? payload.message.content : [];
            const text = content
              .filter(part => part?.type === 'text' && typeof part.text === 'string')
              .map(part => part.text)
              .join('');
            if (text) assistantTextParts.push(text);
            if (payload.message?.errorMessage) {
              fail(new Error('Live chat message failed for ' + modelLabel + ': ' + payload.message.errorMessage));
            }
          }
          if (payload.type === 'error') {
            const message =
              typeof payload.error === 'string'
                ? payload.error
                : payload.error && typeof payload.error.message === 'string'
                ? payload.error.message
                : JSON.stringify(payload.error);
            fail(new Error('Live chat emitted error for ' + modelLabel + ': ' + message + '; payload=' + JSON.stringify(payload).slice(0, 1000)));
          }
          if (payload.type === 'agent_end') {
            if (payload.reason === 'error') {
              fail(new Error('Live chat ended with agent error for ' + modelLabel + '; events=' + JSON.stringify(eventTypes)));
              return;
            }
            finish({ reason: payload.reason || 'complete' });
          }
        };
      });

      const state = await fetchJson('/api/agent-controller/code/sessions/' + encodeURIComponent(resourceId));
      if (state.threadId !== created.threadId) {
        throw new Error('Live chat session lost its active thread.');
      }
      if (runLiveWeb && !toolNames.includes('web_fetch')) {
        throw new Error(
          'Live web E2E did not call web_fetch for ' + modelLabel + '; tools=' + JSON.stringify(toolNames),
        );
      }

      return {
        liveWeb: runLiveWeb,
        requestedModelName,
        modelId: selectedModel.id,
        provider: selectedModel.provider,
        forcedModel: Boolean(forcedModel),
        threadId: created.threadId,
        stateThreadId: state.threadId,
        modeId: state.modeId,
        stateModelId: state.modelId,
        done,
        eventTypes,
        toolNames,
        assistantText: assistantTextParts.at(-1)?.slice(0, 200) ?? '',
      };
    })();
  `;
}

export async function maybeRunDesktopE2E(window: BrowserWindow): Promise<void> {
  const resultFile = readDesktopE2EOption(E2E_RESULT_FILE_ENV, 'mastracode-desktop-e2e-result-file');
  if (!resultFile) return;
  const expectedProjectDir = readDesktopE2EOption(
    'MASTRACODE_DESKTOP_TEST_PROJECT_DIR',
    'mastracode-desktop-test-project-dir',
  );
  const requireAuthedModels = readDesktopE2EBooleanOption(
    E2E_REQUIRE_AUTHED_MODELS_ENV,
    'mastracode-desktop-e2e-require-authed-models',
  );
  const runLiveChat = readDesktopE2EBooleanOption(E2E_LIVE_CHAT_ENV, 'mastracode-desktop-e2e-live-chat');
  const runLiveWeb = readDesktopE2EBooleanOption(E2E_LIVE_WEB_ENV, 'mastracode-desktop-e2e-live-web');
  const liveChatModel = readDesktopE2EOption(E2E_LIVE_CHAT_MODEL_ENV, 'mastracode-desktop-e2e-live-chat-model');

  try {
    await writeDesktopE2EProgress('renderer-e2e-started');
    const details: Record<string, unknown> = {};
    details.bridgePresent = await runRendererStep(
      window,
      'desktop bridge presence',
      'Boolean(window.mastracodeDesktop);',
    );
    if (details.bridgePresent !== true) throw new Error('window.mastracodeDesktop is missing');

    details.appInfo = await runRendererStep(window, 'desktop app info', 'window.mastracodeDesktop.getAppInfo();');
    details.windowTitle = window.getTitle();
    if (details.windowTitle !== 'MastraCode Desktop Alpha') {
      throw new Error(`Unexpected installed desktop window title: ${String(details.windowTitle)}`);
    }
    details.initialBody = await runRendererStep(
      window,
      'initial renderer text',
      'document.body.innerText.slice(0, 1000);',
    );
    await runRendererStep(window, 'open project screen', waitForOpenProjectScreenScript(), 35_000);
    details.localShell = await runRendererStep(
      window,
      'local shell configuration',
      `({
        origin: window.location.origin,
        authEnabled: window.__MASTRACODE_CONFIG__?.authEnabled,
        hasOpenProject: document.body.innerText.includes('Open a project'),
      })`,
    );
    const localShell = details.localShell as { origin?: unknown; authEnabled?: unknown; hasOpenProject?: unknown };
    if (!isLoopbackOrigin(localShell.origin)) {
      throw new Error(`Installed desktop app did not load from a loopback origin: ${String(localShell.origin)}`);
    }
    if (localShell.authEnabled !== false || localShell.hasOpenProject !== true) {
      throw new Error('Installed desktop app did not render the packaged local shell before provider checks');
    }
    await runRendererStep(window, 'click Choose from Finder', clickChooseFromFinderScript(), 35_000);
    details.selectedProject = await runRendererStep(
      window,
      'selected project persistence',
      selectedProjectScript(expectedProjectDir),
      35_000,
    );
    details.modelCatalog = await runRendererStep(
      window,
      'authenticated model catalog',
      modelCatalogScript(requireAuthedModels),
      35_000,
    );
    details.visibleProviderUi = await runRendererStep(
      window,
      'visible provider UI',
      visibleProviderUiScript(requireAuthedModels),
      45_000,
    );
    if (runLiveChat || runLiveWeb) {
      details.liveChat = await runRendererStep(
        window,
        'live chat response',
        liveChatScript(expectedProjectDir, liveChatModel, runLiveWeb),
        100_000,
      );
    }
    details.claudeOAuthStart = await runRendererStep(window, 'Claude OAuth start route', claudeOAuthStartScript());

    await writeResult(resultFile, { ok: true, details });
    await writeDesktopE2EProgress('renderer-e2e-completed');
  } catch (error: unknown) {
    await writeResult(resultFile, { ok: false, error: serializeError(error) });
    await writeDesktopE2EProgress('renderer-e2e-failed', serializeError(error));
  } finally {
    app.quit();
  }
}
