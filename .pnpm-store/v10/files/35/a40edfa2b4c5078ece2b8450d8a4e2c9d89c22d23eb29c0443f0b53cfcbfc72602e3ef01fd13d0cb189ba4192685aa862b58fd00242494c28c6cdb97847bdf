import { components } from './openapi/generated_schema.js';
export interface RestArgs {
    headers: Headers;
    timeout: number;
    connections?: number;
}
export type SchemaFor<K extends keyof T, T extends object = components['schemas']> = T[K];
export type Schemas = components['schemas'];
