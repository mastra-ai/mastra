# @mastra/schema-compat

## 0.10.7-alpha.1

### Patch Changes

- ae2eb63: Handle regex checks better, return description as a string rather than an object with pattern and flags.

## 0.10.7-alpha.0

### Patch Changes

- dd94a26: Dont rely on the full language model for schema compat
- 2fff911: Fix vnext working memory tool schema when model is incompatible with schema

## 0.10.6

### Patch Changes

- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility

## 0.10.6-alpha.0

### Patch Changes

- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility

## 0.10.5

### Patch Changes

- 4da943f: Fix Cannot read properties of undefined (reading 'typeName') in schema compat check

## 0.10.5-alpha.0

### Patch Changes

- 4da943f: Fix Cannot read properties of undefined (reading 'typeName') in schema compat check

## 0.10.4

### Patch Changes

- 0c85311: Fix Google models ZodNull tool schema handling

## 0.10.4-alpha.0

### Patch Changes

- 0c85311: Fix Google models ZodNull tool schema handling

## 0.10.3

### Patch Changes

- 98bbe5a: Claude cannot handle tuple schemas now.
- a853c43: Allow for object.passthrough in schema compat (aka MCP tool support).

## 0.10.3-alpha.1

### Patch Changes

- a853c43: Allow for object.passthrough in schema compat (aka MCP tool support).

## 0.10.3-alpha.0

### Patch Changes

- 98bbe5a: Claude cannot handle tuple schemas now.

## 0.10.2

### Patch Changes

- f6fd25f: Updates @mastra/schema-compat to allow all zod schemas. Uses @mastra/schema-compat to apply schema transformations to agent output schema.
- f9816ae: Create @mastra/schema-compat package to extract the schema compatibility layer to be used outside of mastra

## 0.10.2-alpha.3

### Patch Changes

- f6fd25f: Updates @mastra/schema-compat to allow all zod schemas. Uses @mastra/schema-compat to apply schema transformations to agent output schema.

## 0.10.2-alpha.2

### Patch Changes

- f9816ae: Create @mastra/schema-compat package to extract the schema compatibility layer to be used outside of mastra
