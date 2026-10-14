import type { IntakeConfig } from '../../../services/intake';
import type { LinearStatus } from '../../../services/linear';
import type { GitLabStatus } from '../../../services/gitlab';

export const githubWithLinearConfig: IntakeConfig = {
  github: { enabled: true, sourceIds: ['acme/app'] },
  gitlab: { enabled: false, sourceIds: null },
  linear: { enabled: true, sourceIds: ['proj-1'] },
  jira: { enabled: false, sourceIds: null },
  incidentio: { enabled: false, sourceIds: null },
};
export const gitlabOnlyConfig: IntakeConfig = {
  ...githubWithLinearConfig,
  github: { enabled: false, sourceIds: null },
  linear: { enabled: false, sourceIds: null },
  gitlab: { enabled: true, sourceIds: ['gitlab-1'] },
};
export const connectedLinear: LinearStatus = { enabled: true, connected: true, workspace: null };
export const disabledGitlab: GitLabStatus = { enabled: false, configured: false, reauthRequired: false };
