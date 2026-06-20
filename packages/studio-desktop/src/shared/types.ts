export type ServerMode = 'managed' | 'external';

export interface DesktopSettings {
  serverMode: ServerMode;
  externalServerUrl?: string;
  modelUrl: string;
  modelId: string;
  modelApiKey: string;
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

export interface DesktopState {
  settings: DesktopSettings;
  runtime: RuntimeStatus;
  studio: StudioStatus;
  activeServerUrl?: string;
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

export interface MastraDesktopApi {
  getState: () => Promise<DesktopState>;
  updateSettings: (settings: Partial<DesktopSettings>) => Promise<UpdateSettingsResult>;
  probeLmStudioModels: (modelUrl?: string) => Promise<ProbeModelsResult>;
  restartRuntime: () => Promise<DesktopState>;
  getLogs: () => Promise<string[]>;
  openStudioExternal: () => Promise<void>;
  openDataFolder: () => Promise<void>;
  onStateChanged: (callback: (state: DesktopState) => void) => () => void;
}
