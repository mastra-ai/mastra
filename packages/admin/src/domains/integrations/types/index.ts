import { IntegrationCredentialType } from '@kpl/core';

import { IconName } from '@/types/icons';

// TODO fix any type.
// export type Integration = ReturnType<any>[number];

export type Integration = {
  name: string;
  logoUrl: string;
  isAPIKeyConnection?: boolean;
  APIKeyConnectOptions?: any;
};

export interface IntegrationWithConnection extends Integration {
  connections: number;
}

export type IntegrationConnection = {
  id: string;
  name: string;
  referenceId: string;
  createdAt: Date;
  updatedAt: Date | null;
  lastSyncAt: Date | null;
};

export type IntegrationInstance = {
  name: string;
  logoUrl: string;
  connections: IntegrationConnection[] | undefined;
  authType: IntegrationCredentialType;
  redirectUri: string;
  clientID: string;
  clientSecret: string;
  scopes: string[];
  availableScopes: string[];
};

export interface IntegrationSyncedDataItem {
  label: string;
  count: number;
  type: string;
  icon: IconName;
}

export type IntegrationSyncStatus = {
  connections: number;
  events: number;
  apis: number;
};

export interface DisplayConfig {
  gridView: GridView;
}

export interface GridView {
  fields: Field[];
  data: any[];
}

export interface Field {
  id: number;
  name: string;
  displayName: string;
  type: string;
  order: number;
}

export interface CredentialInfo {
  clientID: string;
  clientSecret: string;
  scopes?: string[];
}

export interface ApiKeyConfigProps {
  type: string;
  properties: {
    [key: string]: {
      type: string;
    };
  };
  required: string[];
  additionalProperties: boolean;
  $schema: string;
}

export interface IntegrationPackage {
  name: string;
  packageName: string;
  logoUrl: string;
  authType: IntegrationCredentialType;
  availableScopes: { key: string; description: string }[];
  config: {
    apiKey?: ApiKeyConfigProps;
  };
}
