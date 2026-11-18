import { AlertsScene } from './alerts-scene';
import { ApiKeysScene } from './api-keys-scene';
import { ByokScene } from './byok-scene';
import { ConnectScene } from './connect-scene';
import { DatabasesScene } from './databases-scene';
import { DeploysScene } from './deploys-scene';
import { DestinationsScene } from './destinations-scene';
import { EnvVarsScene } from './env-vars-scene';
import { EnvironmentsScene } from './environments-scene';
import { FilesystemsScene } from './filesystems-scene';
import { GatewayScene } from './gateway-scene';
import { GatewayThreadsScene } from './gateway-threads-scene';
import { ImportersScene } from './importers-scene';
import { KnowledgeScene } from './knowledge-scene';
import { LicenseScene } from './license-scene';
import { LogsScene } from './logs-scene';
import { MemoryScene } from './memory-scene';
import { ModelsScene } from './models-scene';
import { ProjectsScene } from './projects-scene';
import { SandboxesScene } from './sandboxes-scene';
import type { Scene } from './scene-style';
import { SecretsScene } from './secrets-scene';
import { TracesScene } from './traces-scene';
import { UpgradeScene } from './upgrade-scene';
import { VaultScene } from './vault-scene';
import { WidgetsScene } from './widgets-scene';
import { WorkersScene } from './workers-scene';
import { WorkspacesScene } from './workspaces-scene';

export type EmptyStateArtName =
  | 'knowledge'
  | 'workspaces'
  | 'filesystems'
  | 'sandboxes'
  | 'vault'
  | 'secrets'
  | 'environments'
  | 'upgrade'
  | 'memory'
  | 'api-keys'
  | 'connect'
  | 'databases'
  | 'alerts'
  | 'deploys'
  | 'traces'
  | 'gateway'
  | 'byok'
  | 'projects'
  | 'workers'
  | 'importers'
  | 'env-vars'
  | 'widgets'
  | 'destinations'
  | 'license'
  | 'logs'
  | 'gateway-threads'
  | 'models';

export const sceneByName: Record<EmptyStateArtName, Scene> = {
  knowledge: { Scene: KnowledgeScene, viewBox: '-39.4 -83.5 94.4 134.8', width: 105.7, height: 151, hue: 'purple' },
  workspaces: { Scene: WorkspacesScene, viewBox: '-46.4 -80.8 135.3 149.2', width: 151.5, height: 167.1, hue: 'blue' },
  filesystems: { Scene: FilesystemsScene, viewBox: '-25.2 -40.6 66.4 77.1', width: 74.4, height: 86.4, hue: 'blue' },
  sandboxes: { Scene: SandboxesScene, viewBox: '-70.8 -30.1 140.2 102.6', width: 157, height: 114.9, hue: 'yellow' },
  vault: { Scene: VaultScene, viewBox: '-31.2 -51.5 106.2 104.2', width: 118.9, height: 116.7, hue: 'yellow' },
  secrets: { Scene: SecretsScene, viewBox: '-12.2 -27.3 63.8 58.3', width: 71.5, height: 65.3, hue: 'green' },
  environments: { Scene: EnvironmentsScene, viewBox: '-39.4 -86 85.7 133', width: 96, height: 149, hue: 'green' },
  upgrade: { Scene: UpgradeScene, viewBox: '-76.5 -113.8 137.4 185.5', width: 153.9, height: 207.8, hue: 'pink' },
  memory: { Scene: MemoryScene, viewBox: '-18.7 -56 68.2 93.9', width: 76.4, height: 105.2, hue: 'orange' },
  'api-keys': { Scene: ApiKeysScene, viewBox: '-22.5 -73.5 70.8 109.9', width: 79.3, height: 123.1, hue: 'yellow' },
  connect: { Scene: ConnectScene, viewBox: '-34.5 -60.8 82.7 101.7', width: 92.6, height: 113.9, hue: 'blue' },
  databases: { Scene: DatabasesScene, viewBox: '-40.7 -34.4 66.8 111.8', width: 74.8, height: 125.2, hue: 'green' },
  alerts: { Scene: AlertsScene, viewBox: '-16.3 -68.5 56.4 92.5', width: 63.2, height: 103.6, hue: 'orange' },
  deploys: { Scene: DeploysScene, viewBox: '-97.7 -61 137.1 134', width: 153.6, height: 150.1, hue: 'purple' },
  traces: { Scene: TracesScene, viewBox: '-39.4 -52.6 110 107.3', width: 123.2, height: 120.2, hue: 'pink' },
  gateway: { Scene: GatewayScene, viewBox: '-50 -33.7 131.2 77.6', width: 146.9, height: 86.9, hue: 'blue' },
  byok: { Scene: ByokScene, viewBox: '-30.5 -56.8 70.6 96.5', width: 79.1, height: 108.1, hue: 'yellow' },
  projects: { Scene: ProjectsScene, viewBox: '-37.7 -58.6 77.6 106.3', width: 86.9, height: 119.1, hue: 'orange' },
  workers: { Scene: WorkersScene, viewBox: '-90.6 -41 124.7 107.5', width: 139.7, height: 120.4, hue: 'yellow' },
  importers: { Scene: ImportersScene, viewBox: '-39.4 -93.4 98.2 135.7', width: 110, height: 152, hue: 'purple' },
  'env-vars': { Scene: EnvVarsScene, viewBox: '-16.6 -66 61.6 99', width: 69, height: 110.9, hue: 'green' },
  widgets: { Scene: WidgetsScene, viewBox: '-11.1 -66 66.4 93.7', width: 74.4, height: 104.9, hue: 'blue' },
  destinations: { Scene: DestinationsScene, viewBox: '-39 -68.5 57.1 115', width: 64, height: 128.8, hue: 'orange' },
  license: { Scene: LicenseScene, viewBox: '-32.3 -59 88.2 103.3', width: 98.8, height: 115.7, hue: 'yellow' },
  logs: { Scene: LogsScene, viewBox: '-32.3 -12.9 92.9 64', width: 104, height: 71.7, hue: 'pink' },
  'gateway-threads': {
    Scene: GatewayThreadsScene,
    viewBox: '-50 -33.7 131.2 77.6',
    width: 146.9,
    height: 86.9,
    hue: 'blue',
  },
  models: { Scene: ModelsScene, viewBox: '-44.7 -56.3 130 108.2', width: 145.6, height: 121.2, hue: 'purple' },
};
