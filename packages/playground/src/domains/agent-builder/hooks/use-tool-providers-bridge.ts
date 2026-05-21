import { useCallback } from 'react';
import { useFormContext } from 'react-hook-form';

import type { ToolProvidersFormValue } from '../../tool-providers/schemas';
import type { AgentBuilderEditFormValues } from '../schemas';
import type { AgentTool } from '../types/agent-tool';

interface AddIntegrationToolArgs {
  providerId: string;
  toolkit: string;
  toolSlug: string;
  description?: string;
}

interface RemoveIntegrationToolArgs {
  providerId: string;
  toolSlug: string;
}

/**
 * Bridge between the Tools-tab UI and the `toolProviders` form field.
 *
 * Integration tools live under `toolProviders[providerId].tools[<SLUG>]`,
 * keyed by the Composio flat slug (e.g. `GMAIL_FETCH_EMAILS`). The
 * `toolkit` is denormalized onto every entry so the runtime fan-out can
 * group selected slugs without a `<service>.<tool>` slug convention.
 *
 * Connections are intentionally never pruned on uncheck — the Connections
 * tab remains the source of truth for pinned OAuth accounts.
 */
export function useToolProvidersBridge() {
  const { setValue, getValues } = useFormContext<AgentBuilderEditFormValues>();

  const addIntegrationTool = useCallback(
    ({ providerId, toolkit, toolSlug, description }: AddIntegrationToolArgs) => {
      const current = (getValues('toolProviders') ?? {}) as NonNullable<ToolProvidersFormValue>;
      const config = current[providerId] ?? { tools: {}, connections: {} };
      const next: ToolProvidersFormValue = {
        ...current,
        [providerId]: {
          ...config,
          tools: {
            ...(config.tools ?? {}),
            [toolSlug]: { toolkit, ...(description ? { description } : {}) },
          },
        },
      };
      setValue('toolProviders', next, { shouldDirty: true, shouldValidate: true });
    },
    [getValues, setValue],
  );

  const removeIntegrationTool = useCallback(
    ({ providerId, toolSlug }: RemoveIntegrationToolArgs) => {
      const current = (getValues('toolProviders') ?? {}) as NonNullable<ToolProvidersFormValue>;
      const config = current[providerId];
      if (!config) return;
      const { [toolSlug]: _removed, ...remainingTools } = config.tools ?? {};
      const next: ToolProvidersFormValue = {
        ...current,
        [providerId]: { ...config, tools: remainingTools }, // connections preserved
      };
      setValue('toolProviders', next, { shouldDirty: true, shouldValidate: true });
    },
    [getValues, setValue],
  );

  return { addIntegrationTool, removeIntegrationTool };
}

/**
 * `true` when an integration row is checked but its toolkit has no pinned
 * connection in the current form state. Used to drive the inline
 * "Set up connection" affordance on the Tools tab.
 */
export function needsConnectionSetup(item: AgentTool, value: ToolProvidersFormValue | undefined): boolean {
  if (item.type !== 'integration') return false;
  if (!item.isChecked) return false;
  if (!item.providerId || !item.toolkit) return false;
  const list = value?.[item.providerId]?.connections?.[item.toolkit];
  return !list || list.length === 0;
}
