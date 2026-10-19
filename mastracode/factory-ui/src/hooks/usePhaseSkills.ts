import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { PhaseKickoff, PhaseSkillsResponse, SkillLibraryResponse } from '../api/types';

function projectPath(factoryId: string) {
  return `/web/factory/projects/${encodeURIComponent(factoryId)}`;
}

function phasePath(factoryId: string, boardId: string, phaseId: string) {
  return `${projectPath(factoryId)}/phase-skills/${encodeURIComponent(boardId)}/${encodeURIComponent(phaseId)}`;
}

/** What each board phase runs instead of its board's built-in kickoff. */
export function usePhaseSkillsQuery(factoryId: string | undefined) {
  const { client } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.phaseSkills(factoryId),
    queryFn: () => client.get<PhaseSkillsResponse>(`${projectPath(factoryId!)}/phase-skills`),
    enabled: Boolean(factoryId),
    select: data => data.phaseSkills,
  });
}

interface PhaseKey {
  factoryId: string;
  boardId: string;
  phaseId: string;
}

/** Set a phase to a library skill or a prompt, or clear it (`null`) back to the board default. */
export function useSetPhaseSkillMutation() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ factoryId, boardId, phaseId, kickoff }: PhaseKey & { kickoff: PhaseKickoff | null }) =>
      kickoff === null
        ? client.del(phasePath(factoryId, boardId, phaseId))
        : client.put(
            phasePath(factoryId, boardId, phaseId),
            kickoff.skillName !== null ? { skillName: kickoff.skillName } : { prompt: kickoff.prompt },
          ),
    onSuccess: (_result, { factoryId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.phaseSkills(factoryId) });
    },
  });
}

/** The skills in a Factory's skill library. */
export function useSkillLibraryQuery(factoryId: string | undefined) {
  const { client } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.skillLibrary(factoryId),
    queryFn: () => client.get<SkillLibraryResponse>(`${projectPath(factoryId!)}/skill-library`),
    enabled: Boolean(factoryId),
    select: data => data.skills,
  });
}

export interface LibrarySkillInput {
  name: string;
  description: string;
  content: string;
}

/** Create a library skill, or edit one when `existing` names it. */
export function useSaveLibrarySkillMutation() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ factoryId, existing, skill }: { factoryId: string; existing?: string; skill: LibrarySkillInput }) =>
      existing
        ? client.put(`${projectPath(factoryId)}/skill-library/${encodeURIComponent(existing)}`, {
            description: skill.description,
            content: skill.content,
          })
        : client.post(`${projectPath(factoryId)}/skill-library`, skill),
    onSuccess: (_result, { factoryId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.skillLibrary(factoryId) });
    },
  });
}

/** Delete a library skill; phases running it go back to their board default. */
export function useDeleteLibrarySkillMutation() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ factoryId, name }: { factoryId: string; name: string }) =>
      client.del(`${projectPath(factoryId)}/skill-library/${encodeURIComponent(name)}`),
    onSuccess: (_result, { factoryId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.skillLibrary(factoryId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.phaseSkills(factoryId) });
    },
  });
}

export interface BoardPhaseInput {
  id: string;
  title: string;
  kind: 'resting' | 'working' | 'terminal';
  role?: string;
  next: string[];
}

export interface BoardInput {
  title: string;
  initialPhase: string;
  phases: BoardPhaseInput[];
}

function invalidateBoards(queryClient: ReturnType<typeof useQueryClient>, factoryId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.boardCatalog(factoryId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.phaseSkills(factoryId) });
}

/** Create a board for this Factory, or edit one when `boardId` names it. */
export function useSaveBoardMutation() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ factoryId, boardId, board }: { factoryId: string; boardId?: string; board: BoardInput }) =>
      boardId
        ? client.put(`${projectPath(factoryId)}/boards/${encodeURIComponent(boardId)}`, board)
        : client.post(`${projectPath(factoryId)}/boards`, board),
    onSuccess: (_result, { factoryId }) => invalidateBoards(queryClient, factoryId),
  });
}

/** Delete a board this Factory built. Refused while cards are still on it. */
export function useDeleteBoardMutation() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ factoryId, boardId }: { factoryId: string; boardId: string }) =>
      client.del(`${projectPath(factoryId)}/boards/${encodeURIComponent(boardId)}`),
    onSuccess: (_result, { factoryId }) => invalidateBoards(queryClient, factoryId),
  });
}
