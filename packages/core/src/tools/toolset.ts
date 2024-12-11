import { z, ZodObject } from 'zod';

import { ToolApi } from './types';

export abstract class MastraToolset<ToolsParams = void> {
  getStaticTools(_params: ToolsParams): Record<string, ToolApi> {
    throw new Error('Method not implemented.');
  }
  async getTools(_params: ToolsParams): Promise<Record<string, ToolApi>> {
    throw new Error('Method not implemented.');
  }

  jsonSchemaPropertiesToTSTypes(value: any): z.ZodTypeAny {
    if (!value.type) {
      return z.object({});
    }

    let zodType;
    switch (value.type) {
      case 'string':
        zodType = z
          .string()
          .describe((value.description || '') + (value.examples ? `\nExamples: ${value.examples.join(', ')}` : ''));
        break;
      case 'number':
        zodType = z
          .number()
          .describe((value.description || '') + (value.examples ? `\nExamples: ${value.examples.join(', ')}` : ''));
        break;
      case 'integer':
        zodType = z
          .number()
          .int()
          .describe((value.description || '') + (value.examples ? `\nExamples: ${value.examples.join(', ')}` : ''));
        break;
      case 'boolean':
        zodType = z
          .boolean()
          .describe((value.description || '') + (value.examples ? `\nExamples: ${value.examples.join(', ')}` : ''));
        break;
      case 'array':
        zodType = z
          .array(this.jsonSchemaPropertiesToTSTypes(value.items))
          .describe((value.description || '') + (value.examples ? `\nExamples: ${value.examples.join(', ')}` : ''));
        break;
      case 'object':
        zodType = this.jsonSchemaToModel(value).describe(
          (value.description || '') + (value.examples ? `\nExamples: ${value.examples.join(', ')}` : ''),
        );
        break;
      case 'null':
        zodType = z.null().describe(value.description || '');
        break;
      default:
        throw new Error(`Unsupported JSON schema type: ${value.type}`);
    }

    return zodType;
  }

  jsonSchemaToModel(jsonSchema: Record<string, any>): ZodObject<any> {
    const properties = jsonSchema.properties;
    const requiredFields = jsonSchema.required || [];
    if (!properties) {
      return z.object({});
    }

    const zodSchema: Record<string, any> = {};
    for (const [key, _] of Object.entries(properties)) {
      const value = _ as any;
      let zodType;
      if (value.anyOf) {
        const anyOfTypes = value.anyOf.map((schema: any) => this.jsonSchemaPropertiesToTSTypes(schema));
        zodType = z
          .union(anyOfTypes)
          .describe((value.description || '') + (value.examples ? `\nExamples: ${value.examples.join(', ')}` : ''));
      } else if (value.allOf) {
        const allOfTypes = value.allOf.map((schema: any) => this.jsonSchemaPropertiesToTSTypes(schema));
        zodType = z
          .intersection(
            allOfTypes[0],
            allOfTypes.slice(1).reduce((acc: z.ZodTypeAny, schema: z.ZodTypeAny) => acc.and(schema), allOfTypes[0]),
          )
          .describe((value.description || '') + (value.examples ? `\nExamples: ${value.examples.join(', ')}` : ''));
      } else {
        if (!value.type) {
          value.type = 'string';
        }
        zodType = this.jsonSchemaPropertiesToTSTypes(value);
      }

      if (value.description) {
        zodType = zodType.describe(value.description);
      }

      if (requiredFields.includes(key)) {
        zodSchema[key] = zodType;
      } else {
        zodSchema[key] = zodType.nullable();
      }
    }

    return z.object(zodSchema);
  }
}
