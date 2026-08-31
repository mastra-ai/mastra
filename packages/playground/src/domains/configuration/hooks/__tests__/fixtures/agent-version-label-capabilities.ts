import type { GetSystemPackagesResponse } from '@mastra/client-js';

const baseSystemPackages: GetSystemPackagesResponse = {
  packages: [],
  isDev: false,
  cmsEnabled: true,
  observabilityEnabled: false,
};

export const fullAgentVersionLabelCapabilities: GetSystemPackagesResponse = {
  ...baseSystemPackages,
  storageCapabilities: {
    versionLabels: {
      entityTypes: {
        agent: {
          read: true,
          write: true,
          compareAndSwap: true,
          retentionProtection: true,
        },
      },
    },
  },
};

export const readOnlyAgentVersionLabelCapabilities: GetSystemPackagesResponse = {
  ...baseSystemPackages,
  storageCapabilities: {
    versionLabels: {
      entityTypes: {
        agent: {
          read: true,
          write: false,
          compareAndSwap: true,
          retentionProtection: true,
        },
      },
    },
  },
};

export const agentVersionLabelsWithoutCompareAndSwap: GetSystemPackagesResponse = {
  ...baseSystemPackages,
  storageCapabilities: {
    versionLabels: {
      entityTypes: {
        agent: {
          read: true,
          write: true,
          compareAndSwap: false,
          retentionProtection: true,
        },
      },
    },
  },
};

export const agentVersionLabelsWithoutRetentionProtection: GetSystemPackagesResponse = {
  ...baseSystemPackages,
  storageCapabilities: {
    versionLabels: {
      entityTypes: {
        agent: {
          read: true,
          write: true,
          compareAndSwap: true,
          retentionProtection: false,
        },
      },
    },
  },
};

export const absentAgentVersionLabelCapabilities: GetSystemPackagesResponse = baseSystemPackages;

export const storageWithoutVersionLabelCapabilities: GetSystemPackagesResponse = {
  ...baseSystemPackages,
  storageCapabilities: {},
};
