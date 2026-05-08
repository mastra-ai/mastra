import type { StoredSkillResponse } from '@mastra/client-js';
import { toast } from '@mastra/playground-ui';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { LibraryForkOrigin } from '../utils/skill-origin';

export interface ForkSkillParams {
  /** The public Library skill being forked. */
  source: StoredSkillResponse;
  /** Name to give the new private copy. Should not collide with existing user skills. */
  name: string;
  /** Optional override of the description. Defaults to the source description. */
  description?: string;
}

/**
 * Fork a public Library skill into the caller's own catalog as a private copy.
 *
 * This is "Studio is the registry" in action — when registries.skillsSh is off
 * and no custom registries are wired, users still need a way to take a public
 * skill and customize it without affecting the canonical version. We just call
 * `createStoredSkill` with the source's content and an `origin: library-fork`
 * tag so the UI can show provenance later.
 */
export function useForkSkill() {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ForkSkillParams): Promise<StoredSkillResponse> => {
      const { source, name } = params;
      const description = params.description ?? source.description ?? '';

      const origin: LibraryForkOrigin = {
        type: 'library-fork',
        sourceSkillId: source.id,
        sourceSkillName: source.name,
        ...(source.authorId ? { sourceAuthorId: source.authorId } : {}),
      };

      return client.createStoredSkill({
        name,
        description,
        visibility: 'private',
        instructions: source.instructions,
        license: source.license,
        files: source.files,
        metadata: {
          origin: { ...origin, forkedAt: new Date().toISOString() },
        },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stored-skills'] });
      toast.success('Skill forked');
    },
    onError: error => {
      toast.error(`Failed to fork skill: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });
}
