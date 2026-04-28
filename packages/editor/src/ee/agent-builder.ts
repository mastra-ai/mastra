import type { AgentBuilderOptions, IAgentBuilder } from '@mastra/core/agent-builder/ee';
import { isBuilderModelPolicyActive, isModelAllowed } from '@mastra/core/agent-builder/ee';
import { isProviderRegistered } from '@mastra/core/llm';

/**
 * Concrete implementation of the Agent Builder EE feature.
 * Instantiated by MastraEditor.resolveBuilder() when builder config is enabled.
 *
 * The constructor performs fail-fast validation of the admin's model policy
 * (Phase 4) so misconfiguration is caught at boot, not at first request.
 */
export class EditorAgentBuilder implements IAgentBuilder {
  private readonly options: AgentBuilderOptions;
  private readonly modelPolicyWarnings: string[] = [];

  constructor(options?: AgentBuilderOptions) {
    this.options = options ?? {};
    this.validateModelPolicy();
  }

  get enabled(): boolean {
    return this.options.enabled !== false;
  }

  getFeatures(): AgentBuilderOptions['features'] {
    return this.options.features;
  }

  getConfiguration(): AgentBuilderOptions['configuration'] {
    return this.options.configuration;
  }

  getModelPolicyWarnings(): string[] {
    return [...this.modelPolicyWarnings];
  }

  private validateModelPolicy(): void {
    const enabled = this.options.enabled !== false;
    const pickerVisible = this.options.features?.agent?.model === true;
    const models = this.options.configuration?.agent?.models;
    const allowed = models?.allowed;
    const defaultModel = models?.default;

    const active = isBuilderModelPolicyActive({
      enabled,
      pickerVisible,
      allowed,
      default: defaultModel,
    });

    if (!active) return;

    // Locked mode (picker hidden) requires an admin-pinned default. Phase 3's
    // create-path decision matrix relies on this invariant: a locked policy
    // without a default is unreachable.
    if (!pickerVisible && defaultModel === undefined) {
      throw new Error(
        'Agent Builder model policy is active in locked mode but no default was set. ' +
          'Set `editor.builder.configuration.agent.models.default`, or set ' +
          '`editor.builder.features.agent.model = true` to allow end-users to pick a model.',
      );
    }

    // When an allowlist is set, the default (if any) must satisfy it. An
    // empty `allowed: []` means "unrestricted" so we skip this check.
    if (defaultModel !== undefined && allowed !== undefined && allowed.length > 0) {
      if (!isModelAllowed(allowed, defaultModel)) {
        throw new Error(
          'Agent Builder default model is not in the allowlist. ' +
            'Either add it to `editor.builder.configuration.agent.models.allowed` ' +
            'or change `editor.builder.configuration.agent.models.default`.',
        );
      }
    }

    // Sanity warnings for entries with unknown provider strings that aren't
    // tagged as custom gateways. Non-fatal — gateways may register lazily.
    if (allowed !== undefined) {
      for (const entry of allowed) {
        const isCustom = 'kind' in entry && entry.kind === 'custom';
        if (isCustom) continue;
        if (isProviderRegistered(entry.provider)) continue;
        const warning =
          `Agent Builder allowlist contains unknown provider "${entry.provider}". ` +
          `If this is a custom gateway, tag it with \`kind: 'custom'\`. Otherwise, check for a typo.`;
        this.modelPolicyWarnings.push(warning);
        // eslint-disable-next-line no-console
        console.warn(`[mastra:editor:builder] ${warning}`);
      }
    }
  }
}
