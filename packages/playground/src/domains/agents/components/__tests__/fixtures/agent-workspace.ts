import type { GetSystemPackagesResponse } from '@mastra/client-js';
import { systemPackages } from './channels';

export const workspacePackages: GetSystemPackagesResponse = {
  ...systemPackages,
  cmsEnabled: true,
  observabilityEnabled: true,
};
