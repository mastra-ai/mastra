import type { StoredSkillResponse } from '@mastra/client-js';
import { toast } from '@mastra/playground-ui';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { LibraryCopyOrigin } from '@/domains/agent-builder/utils/skill-origin';

export interface CopySkillParams {
  /** The public Library skill being copied. */
  source: StoredSkillResponse;
  /** Name to give the new private copy. Should not collide with existing user skills. */
  name: string;
  /** Optional override of the description. Defaults to the source description. */
  description?: string;
}

/**
 * Copy a public Library skill into the caller's own catalog as a private skill.
 *
 * Users can take a public skill and customize it without affecting the
 * canonical version. We call `createStoredSkill` with the source's content and
 * an `origin: library-copy` tag so the UI can show provenance later.
 */
export function useCopySkill() {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CopySkillParams): Promise<StoredSkillResponse> => {
      const { source, name } = params;
      const description = params.description ?? source.description ?? '';

      const origin: LibraryCopyOrigin = {
        type: 'library-copy',
        sourceSkillId: source.id,
        sourceSkillName: source.name,
        ...(source.authorId ? { sourceAuthorId: source.authorId } : {}),
      };

      return client.createStoredSkill({
        name,
        description,
        visibility: 'private',
        instructions: source.instructions,
        // Optional fields may come back as null from the source; the create
        // schema only accepts an object/array or omitted, so drop nulls.
        ...(source.license != null ? { license: source.license } : {}),
        ...(source.files != null ? { files: source.files } : {}),
        metadata: {
          origin: { ...origin, copiedAt: new Date().toISOString() },
        },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stored-skills'] });
      toast.success('Skill copied');
    },
    onError: error => {
      toast.error(`Failed to copy skill: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });
}
