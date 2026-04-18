import type {
  CreateProjectParams,
  CreateProjectTaskParams,
  InviteProjectAgentParams,
  ProjectResponse,
  UpdateProjectParams,
  UpdateProjectTaskParams,
} from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const useProjects = () => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => client.listProjects(),
  });
};

export const useProject = (projectId?: string) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async (): Promise<ProjectResponse | null> => {
      if (!projectId) return null;
      return client.getProject(projectId);
    },
    enabled: Boolean(projectId),
  });
};

export const useProjectMutations = (projectId?: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['projects'] });
    if (projectId) {
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    }
    // Invited agents show up in the stored-agents list via the project metadata —
    // keep those in sync too.
    void queryClient.invalidateQueries({ queryKey: ['stored-agents'] });
  };

  const createProject = useMutation({
    mutationFn: (params: CreateProjectParams) => client.createProject(params),
    onSuccess: invalidate,
  });

  const updateProject = useMutation({
    mutationFn: (params: UpdateProjectParams) => {
      if (!projectId) throw new Error('projectId is required for update');
      return client.updateProject(projectId, params);
    },
    onSuccess: invalidate,
  });

  const deleteProject = useMutation({
    mutationFn: () => {
      if (!projectId) throw new Error('projectId is required for delete');
      return client.deleteProject(projectId);
    },
    onSuccess: invalidate,
  });

  const inviteAgent = useMutation({
    mutationFn: (params: InviteProjectAgentParams) => {
      if (!projectId) throw new Error('projectId is required for invite');
      return client.inviteProjectAgent(projectId, params);
    },
    onSuccess: invalidate,
  });

  const removeAgent = useMutation({
    mutationFn: (agentId: string) => {
      if (!projectId) throw new Error('projectId is required for remove');
      return client.removeProjectAgent(projectId, agentId);
    },
    onSuccess: invalidate,
  });

  const addTask = useMutation({
    mutationFn: (params: CreateProjectTaskParams) => {
      if (!projectId) throw new Error('projectId is required for addTask');
      return client.addProjectTask(projectId, params);
    },
    onSuccess: invalidate,
  });

  const updateTask = useMutation({
    mutationFn: ({ taskId, params }: { taskId: string; params: UpdateProjectTaskParams }) => {
      if (!projectId) throw new Error('projectId is required for updateTask');
      return client.updateProjectTask(projectId, taskId, params);
    },
    onSuccess: invalidate,
  });

  const deleteTask = useMutation({
    mutationFn: (taskId: string) => {
      if (!projectId) throw new Error('projectId is required for deleteTask');
      return client.deleteProjectTask(projectId, taskId);
    },
    onSuccess: invalidate,
  });

  return {
    createProject,
    updateProject,
    deleteProject,
    inviteAgent,
    removeAgent,
    addTask,
    updateTask,
    deleteTask,
  };
};
