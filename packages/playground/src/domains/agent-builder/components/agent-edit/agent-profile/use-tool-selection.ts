import { useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import type { ToolProvidersFormValue } from '../../../../tool-providers/schemas';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import type { AgentTool } from '../../../types/agent-tool';

/**
 * Owns the form mutations behind the tool picker. Native tools/agents/workflows
 * toggle boolean maps; integration tools live under
 * `toolProviders[providerId].tools` keyed by the bare slug. The auto-pin path
 * (used after a successful OAuth handshake) reuses the same write so the
 * `toolProviders` shape stays in one place.
 */
export const useToolSelection = () => {
  const { setValue, getValues } = useFormContext<AgentBuilderEditFormValues>();

  const writeIntegration = useCallback(
    (providerId: string, mutate: (config: ToolProvidersFormValue[string]) => ToolProvidersFormValue[string]) => {
      const current = getValues('toolProviders') ?? {};
      const existing = current[providerId] ?? { tools: {}, connections: {} };
      setValue('toolProviders', { ...current, [providerId]: mutate(existing) }, { shouldDirty: true });
    },
    [getValues, setValue],
  );

  const toggle = useCallback(
    (item: AgentTool, next: boolean) => {
      if (item.type === 'integration' && item.providerId && item.toolkit) {
        const slug = item.name;
        const toolkit = item.toolkit;
        const description = item.description;
        writeIntegration(item.providerId, existing => {
          const tools = { ...(existing.tools ?? {}) };
          if (next) {
            tools[slug] = { toolkit, ...(description ? { description } : {}) };
          } else {
            delete tools[slug];
          }
          return { ...existing, tools, connections: { ...(existing.connections ?? {}) } };
        });
        return;
      }
      const fieldName = item.type === 'agent' ? 'agents' : item.type === 'workflow' ? 'workflows' : 'tools';
      const current = getValues(fieldName) ?? {};
      setValue(fieldName, { ...current, [item.id]: next }, { shouldDirty: true });
    },
    [getValues, setValue, writeIntegration],
  );

  /**
   * After OAuth completes on a tool card, ensure the tool is checked and pin
   * the freshly-authorized connection so the user doesn't have to open the
   * picker afterwards.
   */
  const pinConnection = useCallback(
    (item: AgentTool, connectionId: string) => {
      if (!item.providerId || !item.toolkit) return;
      const toolkit = item.toolkit;
      const slug = item.name;
      const description = item.description;
      writeIntegration(item.providerId, existing => {
        const tools = { ...(existing.tools ?? {}) };
        if (!tools[slug]) {
          tools[slug] = { toolkit, ...(description ? { description } : {}) };
        }
        const existingPinned = existing.connections?.[toolkit] ?? [];
        const alreadyPinned = existingPinned.some(c => c.connectionId === connectionId);
        const connections = {
          ...(existing.connections ?? {}),
          [toolkit]: alreadyPinned
            ? existingPinned
            : [...existingPinned, { kind: 'author' as const, toolkit, connectionId, scope: 'per-author' as const }],
        };
        return { ...existing, tools, connections };
      });
    },
    [writeIntegration],
  );

  return { toggle, pinConnection };
};
