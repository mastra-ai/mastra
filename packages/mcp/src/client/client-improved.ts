/**
 * Improved MCP Client with better schema handling
 *
 * This version attempts multiple approaches to handle complex schemas:
 * 1. Try original conversion
 * 2. Try simplified schema conversion
 * 3. Try manual schema fixes for known patterns
 * 4. Fallback to permissive schema (with warnings)
 */

import { z } from 'zod';

// Enhanced schema conversion with multiple strategies
function convertInputSchemaImproved(inputSchema: any): z.ZodType {
  if (isZodType(inputSchema)) {
    return inputSchema;
  }

  // Strategy 1: Try original conversion
  try {
    return convertJsonSchemaToZod(inputSchema as JSONSchema);
  } catch (originalError) {
    console.log('🔧 Schema conversion failed, trying repair strategies...');

    // Strategy 2: Try to fix known problematic patterns
    const repairedSchema = repairCommonSchemaIssues(inputSchema);
    if (repairedSchema !== inputSchema) {
      try {
        const result = convertJsonSchemaToZod(repairedSchema);
        console.log('✅ Schema repaired and converted successfully');
        return result;
      } catch (repairError) {
        console.log('⚠️ Schema repair attempt failed');
      }
    }

    // Strategy 3: Try simplified version
    const simplifiedSchema = simplifyComplexSchema(inputSchema);
    try {
      const result = convertJsonSchemaToZod(simplifiedSchema);
      console.log('✅ Simplified schema converted successfully');
      return result;
    } catch (simplifyError) {
      console.log('⚠️ Simplified schema conversion failed');
    }

    // Strategy 4: Manual conversion for known patterns
    const manualSchema = manualSchemaConversion(inputSchema);
    if (manualSchema) {
      console.log('✅ Manual schema conversion successful');
      return manualSchema;
    }

    // Strategy 5: Last resort - permissive fallback (with strong warnings)
    console.error('❌ ALL SCHEMA CONVERSION STRATEGIES FAILED');
    console.error('⚠️ FALLING BACK TO PERMISSIVE SCHEMA - VALIDATION REDUCED');
    console.error('📋 Original error:', originalError);
    console.error('📋 Schema that failed:', JSON.stringify(inputSchema, null, 2));

    // Log to monitoring/telemetry for investigation
    this.log('error', 'Schema conversion completely failed, using unsafe fallback', {
      originalError: originalError instanceof Error ? originalError.message : String(originalError),
      originalSchema: inputSchema,
      fallbackUsed: true,
      requiresInvestigation: true
    });

    return z.object({}).passthrough();
  }
}

// Repair common schema issues that break zod-from-json-schema
function repairCommonSchemaIssues(schema: any): any {
  const repaired = JSON.parse(JSON.stringify(schema)); // Deep clone

  // Fix 1: Handle missing 'items' in array schemas
  function fixArrayItems(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj;

    if (obj.type === 'array' && !obj.items) {
      console.log('🔧 Fixing missing array items');
      obj.items = { type: 'string' }; // Safe default
    }

    // Recursively fix nested objects
    for (const key in obj) {
      if (typeof obj[key] === 'object') {
        obj[key] = fixArrayItems(obj[key]);
      }
    }

    return obj;
  }

  // Fix 2: Simplify complex anyOf structures
  function simplifyAnyOf(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj;

    if (obj.anyOf && Array.isArray(obj.anyOf)) {
      console.log('🔧 Simplifying anyOf structure');
      // Take the first option or create a generic object
      const firstOption = obj.anyOf[0];
      if (firstOption && firstOption.type === 'object') {
        return { ...firstOption, anyOf: undefined };
      } else {
        return { type: 'object', additionalProperties: true };
      }
    }

    // Recursively fix nested objects
    for (const key in obj) {
      if (typeof obj[key] === 'object') {
        obj[key] = simplifyAnyOf(obj[key]);
      }
    }

    return obj;
  }

  let result = fixArrayItems(repaired);
  result = simplifyAnyOf(result);

  return result;
}

// Create a simplified but still type-safe version of complex schemas
function simplifyComplexSchema(schema: any): any {
  // Extract just the basic structure for validation
  const simplified: any = {
    type: 'object',
    properties: {},
    additionalProperties: true
  };

  if (schema.properties) {
    for (const [key, value] of Object.entries(schema.properties)) {
      const prop = value as any;

      // Simplify each property to basic types
      if (prop.type === 'string') {
        simplified.properties[key] = { type: 'string' };
      } else if (prop.type === 'number' || prop.type === 'integer') {
        simplified.properties[key] = { type: 'number' };
      } else if (prop.type === 'boolean') {
        simplified.properties[key] = { type: 'boolean' };
      } else if (prop.type === 'array') {
        simplified.properties[key] = {
          type: 'array',
          items: { type: 'string' } // Safe default
        };
      } else {
        simplified.properties[key] = { type: 'object', additionalProperties: true };
      }
    }
  }

  return simplified;
}

// Manual conversion for known DataForSEO patterns
function manualSchemaConversion(schema: any): z.ZodType | null {
  // Check if this looks like a DataForSEO schema
  const schemaStr = JSON.stringify(schema);

  if (schemaStr.includes('keywords') && schemaStr.includes('location_name')) {
    console.log('🔧 Applying DataForSEO manual schema conversion');

    return z.object({
      keywords: z.array(z.string()).optional(),
      location_name: z.string().optional(),
      language_name: z.string().optional(),
      filters: z.array(z.any()).optional(),
      // Add other common DataForSEO fields
      limit: z.number().optional(),
      offset: z.number().optional(),
      target: z.string().optional(),
      url: z.string().optional(),
    }).passthrough(); // Allow additional properties
  }

  // Add more manual conversions for other known problematic schemas

  return null;
}

// Enhanced parameter validation with better error messages
function validateAndSendParameters(toolName: string, context: any, mcpClient: any) {
  // Validate context more thoroughly
  if (context === undefined || context === null) {
    console.warn(`⚠️ No parameters provided for tool: ${toolName}`);
    console.warn(`📋 This may indicate an issue with parameter passing in your code`);
  }

  // Type checking for common issues
  if (typeof context === 'string') {
    console.warn(`⚠️ Tool ${toolName} received string instead of object. Converting...`);
    context = { query: context }; // Reasonable default
  }

  const argumentsToSend = context || {};

  console.log(`🔧 Executing tool: ${toolName}`, {
    toolArgs: context,
    hasArgs: context !== undefined,
    argType: typeof context,
    argKeys: context ? Object.keys(context) : []
  });

  return mcpClient.callTool({
    name: toolName,
    arguments: argumentsToSend,
  });
}

export {
  convertInputSchemaImproved,
  repairCommonSchemaIssues,
  validateAndSendParameters
};