import type { GetSystemPackagesResponse } from '@mastra/client-js';
import { defaultSystemPackages } from '@/test/msw-server';

export const liveKitUnavailableSystemPackages: GetSystemPackagesResponse = {
  ...defaultSystemPackages,
  liveKitConnectionRouteEnabled: false,
};

export const legacySystemPackages: Omit<GetSystemPackagesResponse, 'liveKitConnectionRouteEnabled'> = {
  packages: [],
  isDev: false,
  cmsEnabled: false,
  observabilityEnabled: false,
};
