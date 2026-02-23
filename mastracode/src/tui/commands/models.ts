import { Spacer } from '@mariozechner/pi-tui';
import { AskQuestionInlineComponent } from '../components/ask-question-inline.js';
import { ModelSelectorComponent } from '../components/model-selector.js';
import type { ModelItem } from '../components/model-selector.js';
import type { SlashCommandContext } from './types.js';

async function showModelListForScope(
  ctx: SlashCommandContext,
  scope: 'global' | 'thread',
  modeId: string,
  modeName: string,
): Promise<void> {
  const availableModels = await ctx.state.harness.listAvailableModels();

  if (availableModels.length === 0) {
    ctx.showInfo('No models available. Check your Mastra configuration.');
    return;
  }

  const currentModelId = ctx.state.harness.getCurrentModelId();
  const scopeLabel = scope === 'global' ? `${modeName} · Global` : `${modeName} · Thread`;

  return new Promise(resolve => {
    const selector = new ModelSelectorComponent({
      tui: ctx.state.ui,
      models: availableModels,
      currentModelId,
      title: `Select model (${scopeLabel})`,
      onSelect: async (model: ModelItem) => {
        ctx.state.ui.hideOverlay();
        try {
          await ctx.state.harness.switchModel({ modelId: model.id, scope, modeId });
          ctx.showInfo(`Model set for ${scopeLabel}: ${model.id}`);
          ctx.updateStatusLine();
        } catch (err) {
          ctx.showError(`Failed to switch model: ${err instanceof Error ? err.message : String(err)}`);
        }
        resolve();
      },
      onCancel: () => {
        ctx.state.ui.hideOverlay();
        resolve();
      },
    });

    ctx.state.ui.showOverlay(selector, {
      width: '80%',
      maxHeight: '60%',
      anchor: 'center',
    });
    selector.focused = true;
  });
}

async function showModelScopeThenList(ctx: SlashCommandContext, modeId: string, modeName: string): Promise<void> {
  const scopes = [
    {
      label: 'Thread default',
      description: `Default for ${modeName} mode in this thread`,
      scope: 'thread' as const,
    },
    {
      label: 'Global default',
      description: `Default for ${modeName} mode in all threads`,
      scope: 'global' as const,
    },
  ];

  return new Promise<void>(resolve => {
    const questionComponent = new AskQuestionInlineComponent(
      {
        question: `Select scope for ${modeName}`,
        options: scopes.map(s => ({
          label: s.label,
          description: s.description,
        })),
        formatResult: answer => `${modeName} · ${answer}`,
        onSubmit: async answer => {
          ctx.state.activeInlineQuestion = undefined;
          try {
            const selected = scopes.find(s => s.label === answer);
            if (selected) {
              await showModelListForScope(ctx, selected.scope, modeId, modeName);
            }
          } catch (err) {
            ctx.showError(`Model selection failed: ${err instanceof Error ? err.message : String(err)}`);
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

export async function handleModelsCommand(ctx: SlashCommandContext): Promise<void> {
  const modes = ctx.state.harness.listModes();
  const currentMode = ctx.state.harness.getCurrentMode();

  const sortedModes = [...modes].sort((a, b) => {
    if (a.id === currentMode?.id) return -1;
    if (b.id === currentMode?.id) return 1;
    return 0;
  });

  const modeOptions = sortedModes.map(mode => ({
    label: mode.name + (mode.id === currentMode?.id ? ' (active)' : ''),
    modeId: mode.id,
    modeName: mode.name,
  }));

  return new Promise<void>(resolve => {
    const questionComponent = new AskQuestionInlineComponent(
      {
        question: 'Select mode',
        options: modeOptions.map(m => ({ label: m.label })),
        formatResult: answer => {
          const mode = modeOptions.find(m => m.label === answer);
          return `Mode: ${mode?.modeName ?? answer}`;
        },
        onSubmit: async answer => {
          ctx.state.activeInlineQuestion = undefined;
          try {
            const selected = modeOptions.find(m => m.label === answer);
            if (selected?.modeId && selected?.modeName) {
              await showModelScopeThenList(ctx, selected.modeId, selected.modeName);
            }
          } catch (err) {
            ctx.showError(`Model selection failed: ${err instanceof Error ? err.message : String(err)}`);
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
