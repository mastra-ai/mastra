import type { Team, Project, Deployment, Build, DeploymentStatus, BuildStatus } from './entities';

export interface AdminStorage {
  teams: TeamStorage;
  projects: ProjectStorage;
  deployments: DeploymentStorage;
  builds: BuildStorage;
  init(): Promise<void>;
  close(): Promise<void>;
}

export interface TeamStorage {
  create(team: Omit<Team, 'id' | 'createdAt' | 'updatedAt'>): Promise<Team>;
  getById(id: string): Promise<Team | null>;
  getBySlug(slug: string): Promise<Team | null>;
  list(): Promise<Team[]>;
  update(id: string, data: Partial<Pick<Team, 'name' | 'slug'>>): Promise<Team>;
  delete(id: string): Promise<void>;
}

export interface ProjectStorage {
  create(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project>;
  getById(id: string): Promise<Project | null>;
  getBySlug(teamId: string, slug: string): Promise<Project | null>;
  listByTeam(teamId: string): Promise<Project[]>;
  update(id: string, data: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Project>;
  delete(id: string): Promise<void>;
}

export interface DeploymentStorage {
  create(deployment: Omit<Deployment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Deployment>;
  getById(id: string): Promise<Deployment | null>;
  listByProject(projectId: string): Promise<Deployment[]>;
  listByStatus(status: DeploymentStatus): Promise<Deployment[]>;
  update(id: string, data: Partial<Omit<Deployment, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Deployment>;
  delete(id: string): Promise<void>;
}

export interface BuildStorage {
  create(build: Omit<Build, 'id' | 'createdAt'>): Promise<Build>;
  getById(id: string): Promise<Build | null>;
  listByDeployment(deploymentId: string): Promise<Build[]>;
  listByStatus(status: BuildStatus): Promise<Build[]>;
  update(id: string, data: Partial<Omit<Build, 'id' | 'createdAt'>>): Promise<Build>;
}

export interface ProjectSourceProvider {
  readonly type: 'local' | 'github' | string;
  listProjects(): Promise<ProjectSource[]>;
  getProject(projectId: string): Promise<ProjectSource | null>;
  validateAccess(source: ProjectSource): Promise<boolean>;
  getProjectPath(source: ProjectSource, targetDir?: string): Promise<string>;
  watchChanges?(source: ProjectSource, callback: (event: ChangeEvent) => void): () => void;
}

export interface ProjectSource {
  id: string;
  name: string;
  type: 'local' | 'github' | string;
  path: string;
  defaultBranch?: string;
  metadata?: Record<string, unknown>;
}

export interface ChangeEvent {
  type: 'add' | 'change' | 'unlink';
  path: string;
}

export interface Runner {
  build(build: Build, deployment: Deployment, project: Project): Promise<void>;
  start(deployment: Deployment, build: Build, port: number): Promise<{ processId: number }>;
  stop(deployment: Deployment): Promise<void>;
  isRunning(processId: number): Promise<boolean>;
}

export interface Router {
  register(config: RouteConfig): Promise<void>;
  unregister(subdomain: string): Promise<void>;
  getRoute(subdomain: string): RouteConfig | undefined;
}

export interface RouteConfig {
  subdomain: string;
  targetPort: number;
  targetHost: string;
}
