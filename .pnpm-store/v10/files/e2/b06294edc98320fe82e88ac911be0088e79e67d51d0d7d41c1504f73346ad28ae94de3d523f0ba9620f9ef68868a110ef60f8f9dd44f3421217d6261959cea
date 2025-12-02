import getToOpenAPISchemaFn$1 from './default-u_dwuiYb.js';
import { e as errorMessageWrapper } from './index-DZEfthgZ.js';
import '@standard-community/standard-json';
import './vendors/convert.js';

function getToOpenAPISchemaFn() {
  return async (schema, context) => {
    if ("_zod" in schema) {
      return getToOpenAPISchemaFn$1()(schema, {
        components: context.components,
        options: { io: "input", ...context.options }
      });
    }
    try {
      const { createSchema } = await import('zod-openapi');
      const { schema: _schema, components } = createSchema(
        // @ts-expect-error
        schema,
        { schemaType: "input", ...context.options }
      );
      if (components) {
        context.components.schemas = {
          ...context.components.schemas,
          ...components
        };
      }
      return _schema;
    } catch {
      throw new Error(
        errorMessageWrapper(`Missing dependencies "zod-openapi v4".`)
      );
    }
  };
}

export { getToOpenAPISchemaFn as default };
