import { StandardSchemaV1 } from '@standard-schema/spec';
import { OpenAPIV3_1 } from 'openapi-types';

type ToOpenAPISchemaContext = {
    components: OpenAPIV3_1.ComponentsObject;
    options?: Record<string, unknown>;
};
type ToOpenAPISchemaFn = (schema: StandardSchemaV1, context: ToOpenAPISchemaContext) => OpenAPIV3_1.SchemaObject | Promise<OpenAPIV3_1.SchemaObject>;

export type { ToOpenAPISchemaContext as T, ToOpenAPISchemaFn as a };
