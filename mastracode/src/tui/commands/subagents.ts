import { Spacer } from '@mariozechner/pi-tui';
import { AskQuestionInlineComponent } from '../components/ask-question-inline.js';
import { ModelSelectorComponent } from '../components/model-selector.js';
import type { ModelItem } from '../components/model-selector.js';
import type { SlashCommandContext } from './types.js';

async function showSubagentModelListForScope(
  ctx: SlashCommandContext,
  scope: 'global' | 'thread',
  agentType: string,
  agentTypeLabel: string,
): Promise<void> {
  const availableModels = await ctx.state.harness.listAvailableModels();

  if (availableModels.length === 0) {
    ctx.showInfo('No models available. Check your Mastra configuration.');
    return;
  }

  const currentSubagentModel = await ctx.state.harness.getSubagentModelId({ agentType });
  const scopeLabel = scope === 'global' ? `${agentTypeLabel} · Global` : `${agentTypeLabel} · Thread`;

  return new Promise(resolve => {
    const selector = new ModelSelectorComponent({
      tui: ctx.state.ui,
      models: availableModels,
      currentModelId: currentSubagentModel ?? undefined,
      title: `Select subagent model (${scopeLabel})`,
      onSelect: async (model: ModelItem) => {
        ctx.state.ui.hideOverlay();
        try {
          await ctx.state.harness.setSubagentModelId({ modelId: model.id, agentType });
          if (scope === 'global') {
            if (ctx.authStorage) {
              ctx.authStorage.setSubagentModelId(model.id, agentType);
              ctx.showInfo(`Subagent model set for ${scopeLabel}: ${model.id}`);
            } else {
              ctx.showError('Cannot persist global preference: auth storage not configured');
            }
          } else {
            ctx.showInfo(`Subagent model set for ${scopeLabel}: ${model.id}`);
          }
        } catch (err) {
          ctx.showError(`Failed to set subagent model: ${err instanceof Error ? err.message : String(err)}`);
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

async function showSubagentScopeThenList(
  ctx: SlashCommandContext,
  agentType: string,
  agentTypeLabel: string,
): Promise<void> {
  const scopes = [
    {
      label: 'Thread default',
      description: `Default for ${agentTypeLabel} subagents in this thread`,
      scope: 'thread' as const,
    },
    {
      label: 'Global default',
      description: `Default for ${agentTypeLabel} subagents in all threads`,
      scope: 'global' as const,
    },
  ];

  return new Promise<void>(resolve => {
    const questionComponent = new AskQuestionInlineComponent(
      {
        question: `Select scope for ${agentTypeLabel} subagents`,
        options: scopes.map(s => ({
          label: s.label,
          description: s.description,
        })),
        formatResult: answer => `${agentTypeLabel} · ${answer}`,
        onSubmit: async answer => {
          ctx.state.activeInlineQuestion = undefined;
          try {
            const selected = scopes.find(s => s.label === answer);
            if (selected) {
              await showSubagentModelListForScope(ctx, selected.scope, agentType, agentTypeLabel);
            }
          } catch (err) {
            ctx.showError(`Subagent selection failed: ${err instanceof Error ? err.message : String(err)}`);
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

export async function handleSubagentsCommand(ctx: SlashCommandContext): Promise<void> {
  const agentTypes = [
    {
      id: 'explore',
      label: 'Explore',
      description: 'Read-only codebase exploration',
    },
    {
      id: 'plan',
      label: 'Plan',
      description: 'Read-only analysis and planning',
    },
    {
      id: 'execute',
      label: 'Execute',
      description: 'Task execution with write access',
    },
  ];

  return new Promise<void>(resolve => {
    const questionComponent = new AskQuestionInlineComponent(
      {
        question: 'Select subagent type',
        options: agentTypes.map(t => ({
          label: t.label,
          description: t.description,
        })),
        formatResult: answer => `Subagent: ${answer}`,
        onSubmit: async answer => {
          ctx.state.activeInlineQuestion = undefined;
          try {
            const selected = agentTypes.find(t => t.label === answer);
            if (selected) {
              await showSubagentScopeThenList(ctx, selected.id, selected.label);
            }
          } catch (err) {
            ctx.showError(`Subagent selection failed: ${err instanceof Error ? err.message : String(err)}`);
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
