export type VcConfig = {
  handler: string;
  launcherType: 'Nodejs';
  runtime: string;
  shouldAddHelpers: boolean;
  maxDuration?: number;
  memory?: number;
  regions?: string[];
};

export type VcConfigOverrides = Pick<VcConfig, 'maxDuration' | 'memory' | 'regions'>;

export interface VercelDeployerOptions extends VcConfigOverrides {}
