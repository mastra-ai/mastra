import { Spacer } from '@mariozechner/pi-tui';
import { getOAuthProviders } from '../../auth/storage.js';
import { AskQuestionInlineComponent } from '../components/ask-question-inline.js';
import { LoginDialogComponent } from '../components/login-dialog.js';
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

    ctx.state.ui.showOverlay(dialog, {
      width: '80%',
      maxHeight: '60%',
      anchor: 'center',
    });
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

        const defaultModel = ctx.authStorage?.getDefaultModelForProvider(providerId as any);
        if (defaultModel) {
          await ctx.state.harness.switchModel({ modelId: defaultModel });
          ctx.updateStatusLine();
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

  const action = mode === 'login' ? 'Log in to' : 'Log out from';

  return new Promise<void>(resolve => {
    const questionComponent = new AskQuestionInlineComponent(
      {
        question: `${action} which provider?`,
        options: providers.map(p => ({
          label: p.name,
          description: loggedInIds.includes(p.id) ? '(logged in)' : '',
        })),
        formatResult: answer => (mode === 'login' ? `Logging in to ${answer}…` : `Logged out from ${answer}`),
        onSubmit: async answer => {
          ctx.state.activeInlineQuestion = undefined;
          const provider = providers.find(p => p.name === answer);
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
        onCancel: () => {
          ctx.state.activeInlineQuestion = undefined;
          resolve();
        },
      },
      ctx.state.ui,
    );

    ctx.state.activeInlineQuestion = questionComponent;
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.chatContainer.addChild(questionComponent);
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.ui.requestRender();
    ctx.state.chatContainer.invalidate();
  });
}
