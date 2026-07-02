export type ServerMode = 'managed' | 'external';
export type DesktopTabKind = 'launcher' | 'managed' | 'dev' | 'platform';
export type DesktopTabStatus = 'ready' | 'loading' | 'error';
export type PlatformStatus = 'signed-out' | 'signing-in' | 'loading' | 'ready' | 'error';

export interface DesktopSettings {
  version: 3;
  serverMode: ServerMode;
  externalServerUrl?: string;
  devServerUrl: string;
  platformBaseUrl: string;
  platformOrganizationId?: string;
  modelUrl: string;
  modelId: string;
  modelApiKey: string;
  environmentVariables: Record<string, string>;
}

export interface RuntimeStatus {
  state: 'idle' | 'starting' | 'running' | 'stopped' | 'error';
  pid?: number;
  port?: number;
  url?: string;
  error?: string;
}

export interface StudioStatus {
  port?: number;
  url?: string;
}

export interface DesktopTab {
  id: string;
  kind: DesktopTabKind;
  title: string;
  subtitle?: string;
  url?: string;
  sourceUrl?: string;
  externalUrl?: string;
  status: DesktopTabStatus;
  error?: string;
}

export interface PlatformUser {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export interface PlatformOrganization {
  id: string;
  name: string;
  role: string | null;
  isCurrent: boolean;
}

export interface PlatformProject {
  id: string;
  slug: string;
  name: string;
  organizationId: string;
  studioEnabled: boolean;
  serverEnabled: boolean;
  latestDeployStatus: string | null;
  latestDeployCreatedAt: string | null;
  instanceUrl: string | null;
  serverInstanceUrl: string | null;
}

export interface PlatformState {
  baseUrl: string;
  status: PlatformStatus;
  signedIn: boolean;
  organizationId?: string;
  user?: PlatformUser;
  organizations: PlatformOrganization[];
  projects: PlatformProject[];
  error?: string;
}

export interface DesktopState {
  settings: DesktopSettings;
  runtime: RuntimeStatus;
  studio: StudioStatus;
  activeServerUrl?: string;
  tabs: DesktopTab[];
  activeTabId?: string;
  platform: PlatformState;
  logs: string[];
}

export interface ProbeModelsResult {
  ok: boolean;
  modelUrl: string;
  models: string[];
  error?: string;
}

export interface UpdateSettingsResult {
  settings: DesktopSettings;
  state: DesktopState;
}

export interface CreateDevTabInput {
  serverUrl: string;
}

export interface MastraDesktopApi {
  getState: () => Promise<DesktopState>;
  updateSettings: (settings: Partial<DesktopSettings>) => Promise<UpdateSettingsResult>;
  createLauncherTab: () => Promise<DesktopState>;
  createManagedTab: () => Promise<DesktopState>;
  createDevTab: (input: CreateDevTabInput) => Promise<DesktopState>;
  createPlatformTab: (projectId: string) => Promise<DesktopState>;
  activateTab: (tabId: string) => Promise<DesktopState>;
  closeTab: (tabId: string) => Promise<DesktopState>;
  reloadTab: (tabId: string) => Promise<DesktopState>;
  openSettingsTab: () => Promise<DesktopState>;
  openTabExternal: (tabId: string) => Promise<void>;
  startPlatformLogin: () => Promise<DesktopState>;
  logoutPlatform: () => Promise<DesktopState>;
  refreshPlatform: () => Promise<DesktopState>;
  probeLmStudioModels: (modelUrl?: string, apiKey?: string) => Promise<ProbeModelsResult>;
  probeOpenAICompatibleModels: (modelUrl?: string, providerName?: string, apiKey?: string) => Promise<ProbeModelsResult>;
  restartRuntime: () => Promise<DesktopState>;
  getLogs: () => Promise<string[]>;
  openStudioExternal: () => Promise<void>;
  openDataFolder: () => Promise<void>;
  onStateChanged: (callback: (state: DesktopState) => void) => () => void;
}
