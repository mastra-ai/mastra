export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface ApiResponseShape {
  kind: 'array' | 'record' | 'object-property' | 'single' | 'unknown';
  listProperty?: string;
  paginationProperty?: string;
}

export interface ApiCommandExample {
  description: string;
  command: string;
}

export interface ApiCommandDescriptor {
  key: string;
  name: string;
  description: string;
  method: HttpMethod;
  path: string;
  positionals: string[];
  acceptsInput: boolean;
  inputRequired: boolean;
  list: boolean;
  responseShape: ApiResponseShape;
  queryParams: string[];
  bodyParams: string[];
  defaultTimeoutMs?: number;
  examples?: ApiCommandExample[];
}

export type ApiCommandInputMode = 'none' | 'optional' | 'required';

export interface ApiCommandActionOptions {
  description: string;
  input?: ApiCommandInputMode;
  list?: boolean;
  positionals?: string[];
  pathParamsFromInput?: string[];
  defaultTimeoutMs?: number;
  examples?: ApiCommandExample[];
}
