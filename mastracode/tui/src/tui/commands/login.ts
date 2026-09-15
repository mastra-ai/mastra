import { getOAuthProviders, PROVIDER_DEFAULT_MODELS } from '@mastra/code-sdk/auth/storage';
import type { OAuthAccountRecord } from '@mastra/code-sdk/auth/types';
import { LoginAccountManagerComponent } from '../components/login-account-manager.js';
import { LoginDialogComponent } from '../components/login-dialog.js';
import { promptAuthMode } from '../components/login-mode-selector.js';
import { LoginSelectorComponent } from '../components/login-selector.js';
import { seedOMDefaultAfterLogin } from '../om-defaults.js';
import { showModalOverlay } from '../overlay.js';
import type { SlashCommandContext } from './types.js';

function toManagedAccounts(accounts: OAuthAccountRecord[]) {
  return accounts.map(account => ({ id: account.id, label: account.label, active: account.active }));
}

/**
 * After a successful login the active account was just registered — offer a
 * one-shot rename before the dialog closes. Escape or empty submit keeps the
 * label the registry resolved (re-authenticated accounts keep their previous
 * label; new accounts fall back to the provider hook or the default).
 */
async function promptForAccountName(ctx: SlashCommandContext, dialog: LoginDialogComponent, providerId: string) {
  const authStorage = ctx.authStorage;
  if (!authStorage) return;
  const active = authStorage.getActiveAccount(providerId);
  if (!active) return;
  const input = await dialog.promptOptional(`Name this account (Enter to keep "${active.label}")`);
  if (input === null) return;
  const name = input.trim();
  if (name && name !== active.label) {
    authStorage.renameAccount(providerId, active.id, name);
  }
}

async function performLogin(
  ctx: SlashCommandContext,
  providerId: string,
  opts?: { replaceAccountId?: string },
): Promise<void> {
  const provider = getOAuthProviders().find(p => p.id === providerId);
  const providerName = provider?.name || providerId;

  if (!ctx.authStorage) {
    ctx.showError('Auth storage not configured');
    return;
  }

  const authMode = await promptAuthMode(ctx.state.ui, providerName, provider?.authModes);
  if (authMode === null) {
    // User cancelled at the mode-selection step.
    return;
  }

  return new Promise(resolve => {
    const dialog = new LoginDialogComponent(ctx.state.ui, providerId, (success, message) => {
      ctx.state.ui.hideOverlay();
      if (success) {
        ctx.showInfo(`Successfully logged in to ${providerName}`);
      } else if (message) {
        ctx.showInfo(message);
      }
      resolve();
    });

    showModalOverlay(ctx.state.ui, dialog, { widthPercent: 0.8, maxHeight: '60%' });
    dialog.focused = true;

    ctx
      .authStorage!.login(
        providerId,
        {
          onAuth: (info: { url: string; instructions?: string }) => {
            dialog.showAuth(info.url, info.instructions);
          },
          onPrompt: async (prompt: { message: string; placeholder?: string }) => {
            return dialog.showPrompt(prompt.message, prompt.placeholder);
          },
          onProgress: (message: string) => {
            dialog.showProgress(message);
          },
          signal: dialog.signal,
          authMode,
        },
        opts,
      )
      .then(async () => {
        await promptForAccountName(ctx, dialog, providerId);
        ctx.state.ui.hideOverlay();
        ctx.state.controller.invalidateAvailableModelsCache();

        // The `/login` command must not change the user's active model or model
        // pack — that only belongs to the onboarding flow. Only auto-select the
        // provider default when no model is selected yet (e.g. onboarding was
        // skipped), so the user isn't left without a usable model.
        const hasSelectedModel = ctx.state.session.model.get() !== '';
        const defaultModel = PROVIDER_DEFAULT_MODELS[providerId as keyof typeof PROVIDER_DEFAULT_MODELS];
        if (defaultModel && !hasSelectedModel) {
          await ctx.state.session.model.switch({ modelId: defaultModel });
          ctx.showInfo(`Logged in to ${providerName} - switched to ${defaultModel}`);
        } else {
          ctx.showInfo(`Successfully logged in to ${providerName}`);
        }
        await seedOMDefaultAfterLogin(ctx.state, providerId, message => ctx.showInfo(message));

        resolve();
      })
      .catch((error: Error) => {
        ctx.state.ui.hideOverlay();
        if (error.message !== 'Login cancelled') {
          ctx.showError(`Failed to login: ${error.message}`);
        }
        resolve();
      });
  });
}

/**
 * Open the account manager overlay for a provider that already has
 * registered accounts. Add/re-authenticate re-run the normal login flow
 * (`addAccount` updates an existing account in place on id collision).
 */
async function openAccountManager(
  ctx: SlashCommandContext,
  providerId: string,
  providerName: string,
  initialAccounts: OAuthAccountRecord[],
): Promise<void> {
  return new Promise<void>(resolve => {
    const finish = () => {
      ctx.state.ui.hideOverlay();
      resolve();
    };

    const manager = new LoginAccountManagerComponent(providerName, toManagedAccounts(initialAccounts), {
      onAddAnother: () => {
        finish();
        void performLogin(ctx, providerId);
      },
      onReauthenticate: accountId => {
        finish();
        void performLogin(ctx, providerId, { replaceAccountId: accountId });
      },
      onRemove: accountId => {
        const label =
          ctx.authStorage?.listAccounts(providerId).find(account => account.id === accountId)?.label ?? accountId;
        ctx.authStorage?.removeAccount(providerId, accountId);
        ctx.state.controller.invalidateAvailableModelsCache();
        ctx.showInfo(`Removed ${label} from ${providerName}`);
        finish();
      },
      onActivate: accountId => {
        ctx.authStorage?.activateAccount(providerId, accountId);
        ctx.state.controller.invalidateAvailableModelsCache();
        const label =
          ctx.authStorage?.listAccounts(providerId).find(account => account.id === accountId)?.label ?? accountId;
        ctx.showInfo(`Switched ${providerName} to ${label}`);
        finish();
      },
      onBack: () => finish(),
    });

    showModalOverlay(ctx.state.ui, manager, { widthPercent: 0.8, maxHeight: '60%' });
  });
}

export async function handleLoginCommand(ctx: SlashCommandContext, mode: 'login' | 'logout'): Promise<void> {
  const allProviders = getOAuthProviders();
  const loggedInIds = allProviders.filter(p => ctx.authStorage?.isLoggedIn(p.id)).map(p => p.id);

  if (mode === 'logout') {
    if (loggedInIds.length === 0) {
      ctx.showInfo('No OAuth providers logged in. Use /connect first.');
      return;
    }
  }

  const providers = mode === 'logout' ? allProviders.filter(p => loggedInIds.includes(p.id)) : allProviders;

  if (providers.length === 0) {
    ctx.showInfo('No OAuth providers available.');
    return;
  }

  if (mode === 'login') {
    ctx.analytics?.trackInteractivePrompt('login_provider_selector', {
      threadId: ctx.state.session.thread.getId(),
      resourceId: ctx.state.session.identity.getResourceId(),
      mode: ctx.state.session.mode.get(),
    });
  }

  return new Promise<void>(resolve => {
    const selector = new LoginSelectorComponent(
      mode,
      {
        getOAuthProviders: () => providers,
        isLoggedIn: providerId => loggedInIds.includes(providerId),
        countAccounts: providerId => ctx.authStorage?.listAccounts(providerId).length ?? 0,
      },
      async providerId => {
        ctx.state.ui.hideOverlay();
        const provider = providers.find(p => p.id === providerId);
        if (provider) {
          if (mode === 'login') {
            const accounts = ctx.authStorage?.listAccounts(provider.id) ?? [];
            if (accounts.length > 0) {
              await openAccountManager(ctx, provider.id, provider.name, accounts);
            } else {
              await performLogin(ctx, provider.id);
            }
          } else {
            if (ctx.authStorage) {
              ctx.authStorage.logout(provider.id);
              ctx.state.controller.invalidateAvailableModelsCache();
              ctx.showInfo(`Logged out from ${provider.name}`);
            } else {
              ctx.showError('Auth storage not configured');
            }
          }
        }
        resolve();
      },
      () => {
        ctx.state.ui.hideOverlay();
        resolve();
      },
    );

    showModalOverlay(ctx.state.ui, selector, { widthPercent: 0.8, maxHeight: '60%' });
  });
}
