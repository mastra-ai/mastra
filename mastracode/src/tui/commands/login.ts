import { getOAuthProviders, PROVIDER_DEFAULT_MODELS } from '../../auth/storage.js';
import { LoginDialogComponent } from '../components/login-dialog.js';
import { LoginSelectorComponent } from '../components/login-selector.js';
import { showModalOverlay } from '../overlay.js';
import type { SlashCommandContext } from './types.js';

async function performLogin(ctx: SlashCommandContext, providerId: string): Promise<void> {
  const provider = getOAuthProviders().find(p => p.id === providerId);
  const providerName = provider?.name || providerId;

  if (!ctx.authStorage) {
    ctx.showError('Auth storage not configured');
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
      .authStorage!.login(providerId, {
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
      })
      .then(async () => {
        ctx.state.ui.hideOverlay();

        const defaultModel = PROVIDER_DEFAULT_MODELS[providerId as keyof typeof PROVIDER_DEFAULT_MODELS];
        if (defaultModel) {
          await ctx.state.harness.switchModel({ modelId: defaultModel });
          ctx.showInfo(`Logged in to ${providerName} - switched to ${defaultModel}`);
        } else {
          ctx.showInfo(`Successfully logged in to ${providerName}`);
        }

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

export async function handleLoginCommand(ctx: SlashCommandContext, mode: 'login' | 'logout'): Promise<void> {
  const allProviders = getOAuthProviders();
  const loggedInIds = allProviders.filter(p => ctx.authStorage?.isLoggedIn(p.id)).map(p => p.id);

  if (mode === 'logout') {
    if (loggedInIds.length === 0) {
      ctx.showInfo('No OAuth providers logged in. Use /login first.');
      return;
    }
  }

  const providers = mode === 'logout' ? allProviders.filter(p => loggedInIds.includes(p.id)) : allProviders;

  if (providers.length === 0) {
    ctx.showInfo('No OAuth providers available.');
    return;
  }

  return new Promise<void>(resolve => {
    const selector = new LoginSelectorComponent(
      mode,
      {
        getOAuthProviders: () => providers,
        isLoggedIn: providerId => loggedInIds.includes(providerId),
      },
      async providerId => {
        ctx.state.ui.hideOverlay();
        const provider = providers.find(p => p.id === providerId);
        if (provider) {
          if (mode === 'login') {
            await performLogin(ctx, provider.id);
          } else {
            if (ctx.authStorage) {
              ctx.authStorage.logout(provider.id);
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
