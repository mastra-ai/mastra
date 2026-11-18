import { AlertsScene } from './alerts-scene';
import { ApiKeysScene } from './api-keys-scene';
import { ByokScene } from './byok-scene';
import { ConnectScene } from './connect-scene';
import { DatabasesScene } from './databases-scene';
import { DeploysScene } from './deploys-scene';
import { DestinationsScene } from './destinations-scene';
import { EnvVarsScene } from './env-vars-scene';
import { EnvironmentsScene } from './environments-scene';
import { GatewayScene } from './gateway-scene';
import { GatewayThreadsScene } from './gateway-threads-scene';
import { ImportersScene } from './importers-scene';
import { KnowledgeScene } from './knowledge-scene';
import { LicenseScene } from './license-scene';
import { LogsScene } from './logs-scene';
import { MemoryScene } from './memory-scene';
import { ModelsScene } from './models-scene';
import { ProjectsScene } from './projects-scene';
import type { Scene } from './scene-style';
import { TracesScene } from './traces-scene';
import { UpgradeScene } from './upgrade-scene';
import { WidgetsScene } from './widgets-scene';
import { WorkersScene } from './workers-scene';
import { WorkspacesScene } from './workspaces-scene';

export type EmptyStateArtName =
  | 'knowledge'
  | 'workspaces'
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
  knowledge: { Scene: KnowledgeScene, viewBox: '-57 -83.5 124.6 142', width: 139.6, height: 159, hue: 'purple' },
  workspaces: { Scene: WorkspacesScene, viewBox: '-60.6 -80.8 163.6 158.8', width: 183.2, height: 177.9, hue: 'blue' },
  environments: {
    Scene: EnvironmentsScene,
    viewBox: '-55.3 -86 108.8 138.3',
    width: 121.9,
    height: 154.9,
    hue: 'green',
  },
  upgrade: { Scene: UpgradeScene, viewBox: '-92.4 -113.8 174.2 193.6', width: 195.1, height: 216.8, hue: 'pink' },
  memory: { Scene: MemoryScene, viewBox: '-34.1 -56 92.9 100.4', width: 104, height: 112.4, hue: 'orange' },
  'api-keys': { Scene: ApiKeysScene, viewBox: '-39.4 -73.5 98.2 120.5', width: 110, height: 135, hue: 'yellow' },
  connect: { Scene: ConnectScene, viewBox: '-69.4 -46 119.4 103.7', width: 133.7, height: 116.1, hue: 'blue' },
  databases: { Scene: DatabasesScene, viewBox: '-74.7 -34.4 128.2 111.8', width: 143.6, height: 125.2, hue: 'green' },
  alerts: { Scene: AlertsScene, viewBox: '-37.6 -52.5 92.9 96.9', width: 104, height: 108.5, hue: 'orange' },
  deploys: { Scene: DeploysScene, viewBox: '-111.8 -61 161.8 139.9', width: 181.2, height: 156.7, hue: 'purple' },
  traces: { Scene: TracesScene, viewBox: '-50 -52.6 130 115.6', width: 145.6, height: 129.5, hue: 'pink' },
  gateway: { Scene: GatewayScene, viewBox: '-55.3 -33.7 142.4 86.1', width: 159.5, height: 96.4, hue: 'blue' },
  byok: { Scene: ByokScene, viewBox: '-53.5 -56.8 103.5 106.5', width: 115.9, height: 119.3, hue: 'yellow' },
  projects: { Scene: ProjectsScene, viewBox: '-57 -58.5 110.5 111.7', width: 123.8, height: 125.1, hue: 'orange' },
  workers: { Scene: WorkersScene, viewBox: '-103 -41 147.7 112.8', width: 165.4, height: 126.3, hue: 'yellow' },
  importers: { Scene: ImportersScene, viewBox: '-50 -93.4 123 139.6', width: 137.8, height: 156.4, hue: 'purple' },
  'env-vars': { Scene: EnvVarsScene, viewBox: '-30.5 -66 82.2 105.1', width: 92.1, height: 117.7, hue: 'green' },
  widgets: { Scene: WidgetsScene, viewBox: '-25.2 -66 89.3 109.5', width: 100, height: 122.6, hue: 'blue' },
  destinations: {
    Scene: DestinationsScene,
    viewBox: '-69.4 -68.6 115.8 120.1',
    width: 129.7,
    height: 134.5,
    hue: 'orange',
  },
  license: { Scene: LicenseScene, viewBox: '-51.7 -59 114 109.6', width: 127.7, height: 122.8, hue: 'yellow' },
  logs: { Scene: LogsScene, viewBox: '-42.9 -12.9 114.1 67.9', width: 127.8, height: 76, hue: 'pink' },
  'gateway-threads': {
    Scene: GatewayThreadsScene,
    viewBox: '-55.3 -33.7 142.4 86.1',
    width: 159.5,
    height: 96.4,
    hue: 'blue',
  },
  models: { Scene: ModelsScene, viewBox: '-64.1 -56.3 161.8 115.7', width: 181.2, height: 129.6, hue: 'purple' },
};
