import type { RefinedIntegrationEvent } from '@mastra/core';

import { IconName } from '@/types/icons';

// TODO fix any type.
// export type Integration = ReturnType<any>[number];

export enum IntegrationCredentialType {
  OAUTH = 'OAUTH',
  API_KEY = 'API_KEY',
  SYSTEM = 'SYSTEM',
}

export type Integration = {
  name: string;
  logoUrl: string;
  isAPIKeyConnection?: boolean;
  APIKeyConnectOptions?: any;
  isLoading?: boolean;
};

export interface IntegrationWithEntityTypes extends Integration {
  entityTypes: string[];
}

export interface IntegrationWithConnection extends Integration {
  connections: number;
}

export interface IntegrationWithConnectionAndEntityTypes extends Integration {
  connections: number;
  entityTypes: string[];
}

export type IntegrationConnection = {
  id: string;
  name: string;
  connectionId: string;
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
  availableScopes: {
    key: string;
    description: string;
  }[];
  config?: {
    apiKey?: ApiKeyConfigProps;
  };
  isUserDefined?: boolean;
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
  isUserDefined?: boolean;
}

export const entityTypeToIcon: Record<string, IconName> = {
  EMAIL: 'envelope',
  CONTACTS: 'user',
  CALENDAR: 'calendar',
  ACTION: 'activity',
};

export const entityTypeToLabelMap: Record<string, string> = {
  CONTACTS: 'Contact',
  CALENDAR: 'Calendar Event',
};

export interface IntegrationSyncEvent extends RefinedIntegrationEvent {
  syncEvent: string;
  entityType: string;
}
