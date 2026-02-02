# Phase 11: Dataset Schema Validation - Research

**Researched:** 2026-02-02
**Domain:** JSON Schema validation, TypeScript, dataset input/output enforcement
**Confidence:** HIGH

## Summary

This phase adds optional JSON Schema validation for dataset items. The codebase already has a robust schema ecosystem through `@mastra/schema-compat` which provides bidirectional conversion between Zod and JSON Schema. Workflows and agents expose their input/output schemas via `WorkflowInfo.inputSchema` and `WorkflowInfo.outputSchema` (serialized JSON strings), enabling schema import functionality.

The validation library choice is clear: use **Ajv** (Another JSON Validator) for runtime JSON Schema validation. Ajv is the industry standard with 14,500+ GitHub stars, excellent TypeScript support, field-level error reporting via `instancePath`, and is already a transitive dependency through the broader ecosystem. The existing `@mastra/schema-compat` package provides `zodToJsonSchema` and `jsonSchemaToZod` utilities that integrate directly with this approach.

The architecture pattern follows: store schemas as JSON Schema objects on the Dataset entity, validate at the storage layer boundary (before persistence), and surface validation errors through the API with field-level detail. CSV import validation happens row-by-row, collecting failures for a summary report.

**Primary recommendation:** Add Ajv for JSON Schema validation, extend Dataset type with optional `inputSchema`/`outputSchema` fields, validate in storage layer's `addItem`/`updateItem` methods, and expose workflow/agent schema extraction via new API routes.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library     | Version | Purpose                                   | Why Standard                                                    |
| ----------- | ------- | ----------------------------------------- | --------------------------------------------------------------- |
| ajv         | ^8.x    | JSON Schema validation                    | Industry standard, 14.5k stars, type guards, field-level errors |
| ajv-formats | ^3.x    | Format validation (email, uri, date-time) | Official companion for common string formats                    |

### Supporting (Already in Codebase)

| Library               | Version      | Purpose                          | When to Use                                  |
| --------------------- | ------------ | -------------------------------- | -------------------------------------------- |
| @mastra/schema-compat | workspace    | Zod <-> JSON Schema conversion   | When importing schemas from workflows/agents |
| json-schema           | ^7.x (types) | TypeScript types for JSON Schema | Type definitions for schema storage          |

### Alternatives Considered

| Instead of | Could Use    | Tradeoff                                                                              |
| ---------- | ------------ | ------------------------------------------------------------------------------------- |
| Ajv        | Zod directly | Zod requires JS runtime to parse schema; JSON Schema is serializable/storable         |
| Ajv        | TypeBox      | TypeBox better for schema authoring; Ajv better for validating against stored schemas |

**Installation:**

```bash
# In packages/core (where DatasetsStorage lives)
pnpm add ajv ajv-formats
```

## Architecture Patterns

### Schema Storage on Dataset Entity

Extend `Dataset` type to include optional schemas:

```typescript
// Source: packages/core/src/storage/types.ts (proposed extension)
export interface Dataset {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  version: Date;
  // NEW: Optional JSON Schema validation
  inputSchema?: JSONSchema7 | null; // null = explicitly disabled
  outputSchema?: JSONSchema7 | null; // null = explicitly disabled
  createdAt: Date;
  updatedAt: Date;
}
```

**Design rationale:**

- `undefined` = schema not configured (no validation)
- `null` = schema explicitly disabled (for clarity in UI)
- `JSONSchema7` = active validation schema

### Validation at Storage Boundary

```typescript
// Source: Proposed pattern for DatasetsStorage
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

// Pre-compile schemas for performance
const inputValidators = new Map<string, ValidateFunction>();
const outputValidators = new Map<string, ValidateFunction>();

async addItem(args: AddDatasetItemInput): Promise<DatasetItem> {
  const dataset = await this.getDatasetById({ id: args.datasetId });

  // Validate input if schema enabled
  if (dataset.inputSchema) {
    const validate = this.getOrCompileValidator(dataset.id, 'input', dataset.inputSchema);
    if (!validate(args.input)) {
      throw new ValidationError('input', validate.errors);
    }
  }

  // Validate expectedOutput if schema enabled and value provided
  if (dataset.outputSchema && args.expectedOutput !== undefined) {
    const validate = this.getOrCompileValidator(dataset.id, 'output', dataset.outputSchema);
    if (!validate(args.expectedOutput)) {
      throw new ValidationError('expectedOutput', validate.errors);
    }
  }

  // Proceed with storage...
}
```

### Validation Error Structure

```typescript
// Source: Proposed type for field-level errors
export interface SchemaValidationError {
  field: 'input' | 'expectedOutput';
  errors: Array<{
    path: string; // JSON Pointer, e.g., "/name" or "/address/city"
    keyword: string; // e.g., "type", "required", "minLength"
    message: string; // Human-readable error
    params: unknown; // Keyword-specific context
  }>;
}
```

### Schema Import from Workflow/Agent

```typescript
// Source: Pattern for extracting schema from WorkflowInfo
import { WorkflowInfo } from '@mastra/core/workflows';

function extractSchemaFromWorkflow(workflow: Workflow): {
  inputSchema?: JSONSchema7;
  outputSchema?: JSONSchema7;
} {
  const info = workflow.getInfo(); // Returns WorkflowInfo

  return {
    inputSchema: info.inputSchema ? JSON.parse(info.inputSchema) : undefined,
    outputSchema: info.outputSchema ? JSON.parse(info.outputSchema) : undefined,
  };
}
```

### Anti-Patterns to Avoid

- **Validating in UI layer:** Validation must happen at storage layer for consistency
- **Storing Zod schemas:** Zod is not serializable; always convert to JSON Schema for storage
- **Eager validation on all reads:** Only validate on writes (add/update), never on reads

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem                | Don't Build                    | Use Instead                                  | Why                                               |
| ---------------------- | ------------------------------ | -------------------------------------------- | ------------------------------------------------- |
| JSON Schema validation | Custom validator               | Ajv                                          | Edge cases (refs, formats, coercion), performance |
| Zod to JSON Schema     | Manual conversion              | `zodToJsonSchema` from @mastra/schema-compat | Already handles Zod v3/v4 quirks                  |
| JSON Schema to Zod     | Manual conversion              | `jsonSchemaToZod` from @mastra/schema-compat | Handles optional, nullable, defaults              |
| Schema compilation     | Re-compile on every validation | Ajv compile + cache                          | 100x performance difference                       |

**Key insight:** JSON Schema validation has decades of edge cases (recursive schemas, $refs, format validation, type coercion). Ajv handles all of these; a custom solution would need years to reach parity.

## Common Pitfalls

### Pitfall 1: Schema Drift on Import

**What goes wrong:** User imports schema from workflow, workflow schema changes, dataset schema becomes stale
**Why it happens:** Schemas are copied, not referenced
**How to avoid:** This is intentional (per requirements). Document clearly that imported schemas are snapshots
**Warning signs:** User confusion when workflow behavior differs from dataset validation

### Pitfall 2: Validation Blocking All Saves

**What goes wrong:** User enables schema, existing items fail validation, user cannot save any changes
**Why it happens:** Schema enforcement applied retroactively without migration path
**How to avoid:** Validate ALL existing items BEFORE enabling schema; reject schema change if items fail
**Warning signs:** "Failed to enable schema" errors without explanation

### Pitfall 3: Null vs Undefined in JSON Schema

**What goes wrong:** Dataset item has `expectedOutput: null` but schema requires object
**Why it happens:** JSON Schema `type: "object"` does not allow null by default
**How to avoid:** Use Ajv's strict mode off or document that nullable fields need explicit `nullable: true`
**Warning signs:** Validation failures on "empty" values

### Pitfall 4: Large CSV Import Performance

**What goes wrong:** Importing 10,000 rows takes minutes because schema recompiled per row
**Why it happens:** Not caching compiled validators
**How to avoid:** Compile schema once, reuse `ValidateFunction` for all rows
**Warning signs:** Linear time growth with row count beyond disk I/O

### Pitfall 5: Error Message Explosion

**What goes wrong:** UI shows 500 validation errors for a single malformed CSV
**Why it happens:** Ajv's `allErrors: true` + many rows + multiple fields per row
**How to avoid:** Limit error collection (e.g., first 10 failing rows, first 5 errors per row)
**Warning signs:** API response timeouts, UI freezes

## Code Examples

Verified patterns from official sources:

### Basic Ajv Validation

```typescript
// Source: https://ajv.js.org/guide/getting-started.html
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const schema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    age: { type: 'integer', minimum: 0 },
  },
  required: ['name'],
};

const validate = ajv.compile(schema);

const data = { name: '', age: -1 };
if (!validate(data)) {
  // validate.errors contains field-level errors:
  // [
  //   { instancePath: '/name', keyword: 'minLength', message: 'must NOT have fewer than 1 characters' },
  //   { instancePath: '/age', keyword: 'minimum', message: 'must be >= 0' },
  // ]
  console.log(validate.errors);
}
```

### Converting Workflow Schema to JSON Schema

```typescript
// Source: packages/schema-compat/src/zod-to-json.ts (existing utility)
import { zodToJsonSchema } from '@mastra/schema-compat/zod-to-json';
import type { JSONSchema7 } from 'json-schema';

// For a workflow with Zod schema
const workflow = mastra.getWorkflowById('my-workflow');
const zodInputSchema = workflow.inputSchema;

// Convert to JSON Schema for storage
const jsonSchema: JSONSchema7 = zodToJsonSchema(zodInputSchema);
```

### Extracting Schema from WorkflowInfo (API Route)

```typescript
// Source: packages/server/src/server/handlers/workflows.ts (existing pattern)
// WorkflowInfo already has inputSchema/outputSchema as serialized JSON strings

// Proposed API route handler:
export const GET_WORKFLOW_SCHEMA_ROUTE = createRoute({
  method: 'GET',
  path: '/workflows/:workflowId/schema',
  handler: async ({ mastra, workflowId }) => {
    const workflow = mastra.getWorkflowById(workflowId);
    const info = getWorkflowInfo(workflow);

    return {
      inputSchema: info.inputSchema ? JSON.parse(info.inputSchema) : null,
      outputSchema: info.outputSchema ? JSON.parse(info.outputSchema) : null,
    };
  },
});
```

### Validating CSV Import with Row Tracking

```typescript
// Source: Proposed pattern
interface CsvValidationResult {
  validRows: Array<{ rowNumber: number; data: unknown }>;
  invalidRows: Array<{
    rowNumber: number;
    errors: Array<{ path: string; message: string }>;
  }>;
}

function validateCsvRows(rows: unknown[], schema: JSONSchema7, maxErrors = 10): CsvValidationResult {
  const validate = ajv.compile(schema);
  const validRows: CsvValidationResult['validRows'] = [];
  const invalidRows: CsvValidationResult['invalidRows'] = [];

  for (let i = 0; i < rows.length; i++) {
    if (validate(rows[i])) {
      validRows.push({ rowNumber: i + 2, data: rows[i] }); // +2 for header row
    } else {
      invalidRows.push({
        rowNumber: i + 2,
        errors: (validate.errors || []).slice(0, 5).map(err => ({
          path: err.instancePath || '/',
          message: err.message || 'Validation failed',
        })),
      });

      // Stop collecting after maxErrors failures
      if (invalidRows.length >= maxErrors) break;
    }
  }

  return { validRows, invalidRows };
}
```

## State of the Art

| Old Approach            | Current Approach         | When Changed | Impact                                       |
| ----------------------- | ------------------------ | ------------ | -------------------------------------------- |
| tv4, z-schema           | Ajv                      | 2018+        | Ajv became de facto standard for performance |
| JSON Schema draft-04    | draft-07/2019-09/2020-12 | 2019+        | Use draft-07 for broad compatibility         |
| Manual error formatting | Ajv-errors plugin        | 2020+        | Custom error messages per field              |

**Deprecated/outdated:**

- **tv4, jsonschema, z-schema:** Slower, less maintained; use Ajv
- **JSON Schema draft-04:** Outdated; use draft-07 minimum
- **Ajv 6.x:** Superseded by Ajv 8.x with better ESM/TypeScript support

## Open Questions

Things that couldn't be fully resolved:

1. **Schema versioning on datasets**
   - What we know: Dataset already has timestamp-based `version` field
   - What's unclear: Should schema changes bump the version? (Likely yes for consistency)
   - Recommendation: Treat schema changes like item changes - bump version

2. **Agent schema extraction**
   - What we know: Agents don't have a direct `inputSchema`/`outputSchema` like workflows
   - What's unclear: How to present "agent schema" in UI (agents use message format, not structured input)
   - Recommendation: Initially support only workflows for schema import; agents can use custom schema entry

3. **Schema UI editor**
   - What we know: Requirements say "define custom JSON Schema"
   - What's unclear: Full JSON Schema editor vs. simplified form builder?
   - Recommendation: Start with CodeEditor for raw JSON Schema; can enhance later

## Sources

### Primary (HIGH confidence)

- Ajv official documentation: https://ajv.js.org/api.html - Error structure, TypeScript usage
- @mastra/schema-compat source: packages/schema-compat/src/zod-to-json.ts - Existing conversion utilities
- Mastra storage types: packages/core/src/storage/types.ts - Dataset/DatasetItem structure
- Mastra workflow types: packages/core/src/workflows/types.ts - WorkflowInfo schema fields

### Secondary (MEDIUM confidence)

- Ajv npm package: https://www.npmjs.com/package/ajv - Version, install instructions
- GitHub ajv-validator/ajv: https://github.com/ajv-validator - Stars, maintenance status

### Tertiary (LOW confidence)

- None required; all critical findings verified with primary sources

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - Ajv is clear industry standard, existing schema-compat utilities
- Architecture: HIGH - Follows existing Mastra storage patterns, well-understood validation flow
- Pitfalls: HIGH - Common issues documented in Ajv docs and codebase patterns

**Research date:** 2026-02-02
**Valid until:** 60 days (stable domain, Ajv mature library)
