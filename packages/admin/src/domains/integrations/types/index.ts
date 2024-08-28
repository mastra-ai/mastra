// TODO fix any type.
export type Integration = ReturnType<any>[number];
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
}

export interface IntegrationNameAndLogo {
  name: string;
  logoUrl: string;
}
