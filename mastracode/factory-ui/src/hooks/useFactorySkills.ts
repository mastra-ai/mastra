import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { FactorySkillsResponse } from '../api/types';

/**
 * The read-only catalog of Factory skills bundled with the server — the
 * stage playbooks (triage, plan, review, …) automated Factory runs follow.
 * Mirrors `GET /web/factory/skills`.
 */
export function useFactorySkillsQuery() {
  const { client } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.factorySkills(),
    queryFn: () => client.get<FactorySkillsResponse>('/web/factory/skills'),
    select: data => data.skills,
  });
}
