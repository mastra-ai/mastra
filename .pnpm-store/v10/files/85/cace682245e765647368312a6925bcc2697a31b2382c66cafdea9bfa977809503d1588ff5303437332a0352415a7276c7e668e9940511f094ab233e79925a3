import * as quansync from 'quansync';
import * as json_schema from 'json-schema';
import { JSONSchema7 } from 'json-schema';
import { StandardSchemaV1 } from '@standard-schema/spec';

type ToJsonSchemaFn = (schema: unknown, options?: Record<string, unknown>) => JSONSchema7 | Promise<JSONSchema7>;

/**
 * Converts a Standard Schema to a JSON schema.
 */
declare const toJsonSchema: quansync.QuansyncFn<json_schema.JSONSchema7 | Promise<json_schema.JSONSchema7>, [schema: StandardSchemaV1<unknown, unknown>, options?: Record<string, unknown> | undefined]>;
declare function loadVendor(vendor: string, fn: ToJsonSchemaFn): void;

export { type ToJsonSchemaFn, loadVendor, toJsonSchema };
