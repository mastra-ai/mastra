export interface Team {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  teamId: string;
  name: string;
  slug: string;
  sourceType: 'local' | 'github';
  sourceConfig: Record<string, unknown>;
  defaultBranch: string;
  envVars: EncryptedEnvVar[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Deployment {
  id: string;
  projectId: string;
  type: 'production' | 'staging' | 'preview';
  branch: string;
  slug: string;
  status: DeploymentStatus;
  currentBuildId: string | null;
  publicUrl: string | null;
  port: number | null;
  processId: number | null;
  envVarOverrides: EncryptedEnvVar[];
  createdAt: Date;
  updatedAt: Date;
}

export type DeploymentStatus = 'pending' | 'building' | 'running' | 'stopped' | 'failed';

export interface Build {
  id: string;
  deploymentId: string;
  trigger: 'manual' | 'webhook' | 'schedule';
  status: BuildStatus;
  logPath: string | null;
  queuedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
}

export type BuildStatus = 'queued' | 'building' | 'deploying' | 'succeeded' | 'failed';

export interface EncryptedEnvVar {
  key: string;
  encryptedValue: string;
  isSecret: boolean;
}
