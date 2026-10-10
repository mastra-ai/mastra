import type { StoredSkillResponse } from '@mastra/client-js';
import { toast } from '@mastra/playground-ui/utils/toast';
import type { StoredAgent } from '@mastra/react/hooks/agents';
import { useStoredAgentMutations } from '@mastra/react/hooks/agents';
import { useCallback, useRef } from 'react';
import type { AgentBuilderEditFormValues } from '../schemas';
import { formValuesToUpdateParams } from '../services/form-values-to-update-params';
import type { AgentTool } from '../types/agent-tool';
import { isModelNotAllowedError } from '../utils/is-model-not-allowed';
import { useDefaultVisibility } from '@/domains/auth/hooks/use-default-visibility';

interface UseSaveAgentArgs {
  storedAgent: StoredAgent;
  availableAgentTools?: AgentTool[];
  availableSkills?: StoredSkillResponse[];
  onSuccess?: (agentId: string) => void;
  silent?: boolean;
}

export function useSaveAgent({
  storedAgent,
  availableAgentTools = [],
  availableSkills = [],
  onSuccess,
  silent = false,
}: UseSaveAgentArgs) {
  const agentId = storedAgent.id;
  const savedAgent = useRef(storedAgent);
  const pendingSave = useRef<Promise<unknown> | null>(null);
  const { updateStoredAgent } = useStoredAgentMutations({ agentId: agentId });
  const defaultVisibility = useDefaultVisibility();

  const save = useCallback(
    async (values: AgentBuilderEditFormValues) => {
      const performSave = async () => {
        const params = formValuesToUpdateParams(values, savedAgent.current, availableAgentTools, availableSkills);
        try {
          const updated = await updateStoredAgent.mutateAsync({
            ...params,
            autoPublish: true,
            ...(savedAgent.current.visibility === undefined
              ? { visibility: params.visibility ?? defaultVisibility }
              : {}),
          });
          savedAgent.current = updated;
          if (!silent) toast.success('Agent updated');
          onSuccess?.(agentId);
          return updated;
        } catch (error) {
          const policyDetails = isModelNotAllowedError(error);
          if (policyDetails) {
            toast.error(policyDetails.message);
          } else {
            toast.error(`Failed to save agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
          throw error;
        }
      };
      const request = (pendingSave.current ?? Promise.resolve()).then(performSave, performSave);
      pendingSave.current = request;
      return request;
    },
    [agentId, availableAgentTools, availableSkills, updateStoredAgent, onSuccess, defaultVisibility, silent],
  );

  return { save, isSaving: updateStoredAgent.isPending };
}
