import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminClient } from '../use-admin-client';
import { useAuth } from '../use-auth';
import type { TeamRole } from '@/types/api';

export function useTeamMembers(teamId: string, params?: { page?: number; perPage?: number }) {
  const client = useAdminClient();
  const { session } = useAuth();

  return useQuery({
    queryKey: ['team-members', teamId, params],
    queryFn: () => client.teams.listMembers(teamId, params),
    enabled: !!session?.access_token && !!teamId,
  });
}

export function useInviteMember(teamId: string) {
  const client = useAdminClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { email: string; role: TeamRole }) => client.teams.inviteMember(teamId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      queryClient.invalidateQueries({ queryKey: ['team-invites', teamId] });
    },
  });
}

export function useUpdateMemberRole(teamId: string) {
  const client = useAdminClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: TeamRole }) =>
      client.teams.updateMemberRole(teamId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
    },
  });
}

export function useRemoveMember(teamId: string) {
  const client = useAdminClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => client.teams.removeMember(teamId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
    },
  });
}

export function useTeamInvites(teamId: string) {
  const client = useAdminClient();
  const { session } = useAuth();

  return useQuery({
    queryKey: ['team-invites', teamId],
    queryFn: () => client.teams.listInvites(teamId),
    enabled: !!session?.access_token && !!teamId,
  });
}

export function useCancelInvite(teamId: string) {
  const client = useAdminClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteId: string) => client.teams.cancelInvite(teamId, inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-invites', teamId] });
    },
  });
}
