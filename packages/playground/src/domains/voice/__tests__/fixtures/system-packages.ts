import type { GetSystemPackagesResponse } from '@mastra/client-js';

export const liveKitAvailableSystemPackages: GetSystemPackagesResponse = {
  packages: [],
  isDev: false,
  cmsEnabled: false,
  observabilityEnabled: false,
  liveKitConnectionRouteEnabled: true,
};

export const liveKitUnavailableSystemPackages: GetSystemPackagesResponse = {
  ...liveKitAvailableSystemPackages,
  liveKitConnectionRouteEnabled: false,
};

export const legacySystemPackages: Omit<GetSystemPackagesResponse, 'liveKitConnectionRouteEnabled'> = {
  packages: [],
  isDev: false,
  cmsEnabled: false,
  observabilityEnabled: false,
};
