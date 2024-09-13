import { IntegrationCredentialType } from '@kpl/core';

// TODO fix any type.
// export type Integration = ReturnType<any>[number];

export type Integration = {
  name: string;
  logoUrl: string;
  isAPIKeyConnection?: boolean;
  APIKeyConnectOptions?: any;
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
  availableScopes: string[];
  config: {
    apiKey?: ApiKeyConfigProps;
  };
}
