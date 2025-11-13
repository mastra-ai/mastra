# AI Agent Guide for Creating Codemods

This guide helps AI agents efficiently create codemods with optimal performance and consistency.

## Quick Reference: Codemod Creation Workflow

1. **Scaffold** → 2. **Create Fixtures** → 3. **Run Failing Test** → 4. **Implement** → 5. **Verify**

## Performance Best Practices

**Always optimize for minimal AST traversals:**

- Use shared utility functions from `src/codemods/lib/utils.ts`
- Combine multiple operations into single passes
- Add early returns when no changes needed
- Track instances once, reuse the Set

**Available Utility Functions:**

- `trackClassInstances()` - Track single class instantiations
- `trackMultipleClassInstances()` - Track multiple classes in one pass
- `renameMethod()` / `renameMethods()` - Rename methods efficiently
- `transformMethodCalls()` - Generic method call transformer
- `renameImportAndUsages()` - Handle import+usage renames in one pass
- `transformConstructorProperties()` - Transform constructor properties
- `transformObjectProperties()` - Recursive property transformation

## Step 1: Scaffold the Codemod

```bash
# From repository root:
cd packages/codemod
pnpm scaffold <codemod-name>
```

**Important:** Use the codemod name WITHOUT the `v1/` prefix. The scaffold script automatically adds it.

Example: `pnpm scaffold evals-run-experiment` (NOT `v1/evals-run-experiment`)

This creates:

- `src/codemods/v1/<codemod-name>.ts` - The codemod implementation
- `src/test/<codemod-name>.test.ts` - The test file
- `src/test/__fixtures__/<codemod-name>.input.ts` - Input fixture
- `src/test/__fixtures__/<codemod-name>.output.ts` - Expected output fixture
- Updates `src/lib/bundle.ts` automatically

## Step 2: Create Test Fixtures

**ALWAYS** base your fixtures on the migration guide examples. Never hallucinate changes.

### Input Fixture Template

```typescript
// @ts-nocheck

// POSITIVE TEST CASE - Should transform
// Example from migration guide showing the OLD code
const example = oldPattern();

// Multiple occurrences to test
const example2 = oldPattern();

// NEGATIVE TEST CASE - Should NOT transform
// Unrelated code with similar names/patterns
const otherObj = {
  oldPattern: () => 'different',
};
otherObj.oldPattern(); // Should remain unchanged

// NEGATIVE TEST CASE - Different instance type
class MyClass {
  oldPattern() {
    return 'should not change';
  }
}
const myInstance = new MyClass();
myInstance.oldPattern(); // Should remain unchanged
```

### Output Fixture Template

```typescript
// @ts-nocheck

// POSITIVE TEST CASE - Should transform
// Example from migration guide showing the NEW code
const example = newPattern();

// Multiple occurrences to test
const example2 = newPattern();

// NEGATIVE TEST CASE - Should NOT transform
// Unrelated code remains EXACTLY the same
const otherObj = {
  oldPattern: () => 'different',
};
otherObj.oldPattern(); // Unchanged

// NEGATIVE TEST CASE - Different instance type
class MyClass {
  oldPattern() {
    return 'should not change';
  }
}
const myInstance = new MyClass();
myInstance.oldPattern(); // Unchanged
```

**Critical Rules:**

- ✅ ALWAYS include negative test cases
- ✅ Copy examples DIRECTLY from migration guides
- ✅ Only change what the migration guide says to change
- ✅ Ensure negative test cases remain IDENTICAL in both input and output

## Step 3: Run the Failing Test (TDD)

```bash
pnpm test <codemod-name>
```

**Expected:** Test should FAIL showing the difference between actual output (unchanged) and expected output.

This validates:

- Your fixtures are correct
- The test infrastructure works
- You understand what needs to transform

## Step 4: Implement the Codemod

### Common Codemod Patterns

#### Pattern 1: Method Rename on Tracked Instances (Using Utils)

**Use Case:** Rename a method on specific class instances (Mastra, Workflow, Memory, Agent, Storage, etc.)

**Example:** `mastra.getScorers()` → `mastra.listScorers()`

```typescript
import { createTransformer } from '../lib/create-transformer';
import { trackClassInstances, renameMethod } from '../lib/utils';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Track instances efficiently using shared utility
  const instances = trackClassInstances(j, root, 'Mastra');

  // Early return if no instances found
  if (instances.size === 0) return;

  // Rename method efficiently
  const count = renameMethod(j, root, instances, 'getScorers', 'listScorers');

  if (count > 0) {
    context.hasChanges = true;
    context.messages.push(`Renamed getScorers to listScorers on ${count} Mastra instance(s)`);
  }
});
```

**For multiple method renames:**

```typescript
import { trackClassInstances, renameMethods } from '../lib/utils';

const instances = trackClassInstances(j, root, 'Agent');
if (instances.size === 0) return;

const count = renameMethods(j, root, instances, {
  generateVNext: 'generate',
  streamVNext: 'stream',
});
```

**When to use:**

- Renaming methods on specific class instances
- Need to avoid transforming methods with same name on other objects
- **Always prefer utilities over manual tracking**

#### Pattern 2: Import Path Transformation

**Use Case:** Change import paths

**Example:** `@mastra/evals/scorers/llm` → `@mastra/evals/scorers/prebuilt`

```typescript
import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  const oldPaths = ['@mastra/evals/scorers/llm', '@mastra/evals/scorers/code'];
  const newPath = '@mastra/evals/scorers/prebuilt';

  // Find and update import declarations
  root.find(j.ImportDeclaration).forEach(path => {
    const source = path.value.source.value;

    if (typeof source === 'string' && oldPaths.includes(source)) {
      path.value.source.value = newPath;
      context.hasChanges = true;
    }
  });

  if (context.hasChanges) {
    context.messages.push('Updated import paths to scorers/prebuilt');
  }
});
```

**When to use:**

- Consolidating import paths
- Renaming package paths

#### Pattern 3: Import + Usage Rename (Using Utils)

**Use Case:** Rename both import and all usages of imported identifier

**Example:** `runExperiment` → `runEvals`

```typescript
import { createTransformer } from '../lib/create-transformer';
import { renameImportAndUsages } from '../lib/utils';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Single utility function handles import + all usages efficiently
  const count = renameImportAndUsages(j, root, '@mastra/core/evals', 'runExperiment', 'runEvals');

  if (count > 0) {
    context.hasChanges = true;
    context.messages.push('Renamed runExperiment to runEvals');
  }
});
```

**When to use:**

- Renaming function/class imports and their usages
- Need to handle aliased imports correctly
- Must avoid transforming same-named imports from other packages
- **Always use `renameImportAndUsages()` utility for this pattern**

#### Pattern 4: Type Rename

**Use Case:** Rename TypeScript types in imports and usages

**Example:** `MastraMessageV2` → `MastraDBMessage`

```typescript
import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  const oldTypeName = 'MastraMessageV2';
  const newTypeName = 'MastraDBMessage';

  // Track which local names were imported from @mastra/core
  const importedLocalNames = new Set<string>();

  // Transform import specifiers from @mastra/core
  root
    .find(j.ImportDeclaration)
    .filter(path => {
      const source = path.value.source.value;
      return typeof source === 'string' && source === '@mastra/core';
    })
    .forEach(path => {
      path.value.specifiers?.forEach((specifier: any) => {
        if (
          specifier.type === 'ImportSpecifier' &&
          specifier.imported.type === 'Identifier' &&
          specifier.imported.name === oldTypeName
        ) {
          // Track the local name (could be aliased)
          const localName = specifier.local?.name || oldTypeName;
          importedLocalNames.add(localName);

          // Rename the imported name
          specifier.imported.name = newTypeName;

          // Also update the local name if it matches (not aliased)
          if (specifier.local && specifier.local.name === oldTypeName) {
            specifier.local.name = newTypeName;
          }

          context.hasChanges = true;
        }
      });
    });

  // Only transform usages if it was imported from the specific package
  if (importedLocalNames.size > 0) {
    importedLocalNames.forEach(localName => {
      root.find(j.Identifier, { name: localName }).forEach(path => {
        // Skip identifiers that are part of import declarations
        const parent = path.parent;
        if (parent && parent.value.type === 'ImportSpecifier') {
          return;
        }

        path.value.name = newTypeName;
        context.hasChanges = true;
      });
    });
  }

  if (context.hasChanges) {
    context.messages.push('Renamed MastraMessageV2 type to MastraDBMessage');
  }
});
```

**When to use:**

- Renaming TypeScript types
- Handling both value and type imports

#### Pattern 5: Property Rename in Method Calls (Using Utils)

**Use Case:** Rename object properties in method call arguments

**Example:** `memory.recall({ vectorMessageSearch })` → `memory.recall({ vectorSearchString })`

```typescript
import { createTransformer } from '../lib/create-transformer';
import { trackClassInstances, transformMethodCalls, transformObjectProperties } from '../lib/utils';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Track instances efficiently
  const memoryInstances = trackClassInstances(j, root, 'Memory');
  if (memoryInstances.size === 0) return;

  // Transform method calls efficiently
  const count = transformMethodCalls(j, root, memoryInstances, 'recall', path => {
    const args = path.value.arguments;
    if (args.length === 0 || args[0].type !== 'ObjectExpression') return;

    // Use utility for property transformation
    const renamed = transformObjectProperties(args[0], {
      vectorMessageSearch: 'vectorSearchString',
    });

    if (renamed > 0) {
      context.hasChanges = true;
    }
  });

  if (context.hasChanges) {
    context.messages.push(`Renamed vectorMessageSearch in ${count} recall() call(s)`);
  }
});
```

**When to use:**

- Renaming parameters in method calls
- Updating property names in object arguments
- **Use utilities for instance tracking and property transformation**

#### Pattern 6: Property Rename in Constructor (Using Utils)

**Use Case:** Rename constructor properties

**Example:** PostgresStore `schema` → `schemaName`

```typescript
import { createTransformer } from '../lib/create-transformer';
import { transformConstructorProperties } from '../lib/utils';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Use utility for efficient property transformation
  const count = transformConstructorProperties(j, root, 'PostgresStore', {
    schema: 'schemaName',
  });

  if (count > 0) {
    context.hasChanges = true;
    context.messages.push(`Renamed schema to schemaName in ${count} PostgresStore constructor(s)`);
  }
});
```

**For multiple property renames:**

```typescript
const count = transformConstructorProperties(j, root, 'ClassName', {
  oldProp1: 'newProp1',
  oldProp2: 'newProp2',
  oldProp3: 'newProp3',
});
```

**When to use:**

- Renaming properties in constructor calls
- **Always use utility for constructor property transforms**

#### Pattern 7: Context Property Access Rename

**Use Case:** Rename property access on context parameters in specific function types

**Example:** `context.runCount` → `context.retryCount` in step execution

```typescript
import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  const oldPropertyName = 'runCount';
  const newPropertyName = 'retryCount';

  // Track context parameter names in createStep execute functions
  const contextParamNames = new Set<string>();

  // Find createStep calls and extract context parameter names
  root
    .find(j.CallExpression, {
      callee: { type: 'Identifier', name: 'createStep' },
    })
    .forEach(path => {
      const args = path.value.arguments;
      if (args.length === 0 || args[0].type !== 'ObjectExpression') return;

      const configObj = args[0];

      // Find the execute property
      configObj.properties?.forEach((prop: any) => {
        if (
          (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
          prop.key?.type === 'Identifier' &&
          prop.key.name === 'execute' &&
          (prop.value?.type === 'ArrowFunctionExpression' || prop.value?.type === 'FunctionExpression')
        ) {
          // Extract the second parameter name (context)
          const params = prop.value.params;
          if (params && params.length >= 2 && params[1].type === 'Identifier') {
            contextParamNames.add(params[1].name);
          }
        }
      });
    });

  // Rename context.runCount to context.retryCount
  root.find(j.MemberExpression).forEach(path => {
    const node = path.value;

    // Check if accessing .runCount on a context parameter
    if (
      node.object.type === 'Identifier' &&
      contextParamNames.has(node.object.name) &&
      node.property.type === 'Identifier' &&
      node.property.name === oldPropertyName
    ) {
      node.property.name = newPropertyName;
      context.hasChanges = true;
    }
  });

  if (context.hasChanges) {
    context.messages.push('Renamed context.runCount to context.retryCount');
  }
});
```

**When to use:**

- Renaming properties accessed on specific parameter names
- Need to track parameter names from function signatures

#### Pattern 8: Positional to Object Parameter

**Use Case:** Convert constructor from positional arg to object parameter

**Example:** `new PgVector(connectionString)` → `new PgVector({ connectionString })`

```typescript
import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  root
    .find(j.NewExpression, {
      callee: { type: 'Identifier', name: 'PgVector' },
    })
    .forEach(path => {
      const args = path.value.arguments;

      // Check if it has exactly 1 arg and it's NOT an object expression
      if (args.length === 1 && args[0].type !== 'ObjectExpression') {
        const connectionStringArg = args[0];

        // Replace with object expression
        path.value.arguments = [
          j.objectExpression([j.property('init', j.identifier('connectionString'), connectionStringArg)]),
        ];

        context.hasChanges = true;
      }
    });

  if (context.hasChanges) {
    context.messages.push('Converted PgVector constructor to object parameter');
  }
});
```

**When to use:**

- Converting positional arguments to object parameters
- Refactoring constructor signatures

## Step 5: Verify Implementation

### Run the specific test:

```bash
pnpm test <codemod-name>
```

**Expected:** Test should PASS with message showing what was transformed.

### Run all tests:

```bash
pnpm test
```

**Expected:** All tests should pass, including your new one.

**If tests fail:**

- ❌ DO NOT use `UPDATE_SNAPSHOT` to force tests to pass
- ❌ DO NOT modify fixtures to match incorrect output (unless you made a genuine error in the fixture)
- ✅ Fix the codemod implementation instead
- ✅ Review the test output diff carefully to understand what's wrong

## Performance Guidelines

### DO: Use Shared Utilities

```typescript
// ✅ GOOD - Uses utility (1 pass)
import { trackClassInstances, renameMethods } from '../lib/utils';

const instances = trackClassInstances(j, root, 'Agent');
if (instances.size === 0) return;
renameMethods(j, root, instances, { oldMethod: 'newMethod' });
```

```typescript
// ❌ BAD - Manual implementation (2 passes)
const instances = new Set<string>();
root.find(j.NewExpression).forEach(/* ... */);
root.find(j.CallExpression).forEach(/* ... */);
```

### DO: Combine Operations

```typescript
// ✅ GOOD - Single pass
root.find(j.CallExpression).forEach(path => {
  // Check all conditions inline
  if (callee.type !== 'MemberExpression') return;
  if (!instances.has(callee.object.name)) return;
  // Transform immediately
});
```

```typescript
// ❌ BAD - Multiple passes
root.find(j.CallExpression).filter(/* ... */).forEach(/* ... */);
```

### DO: Add Early Returns

```typescript
// ✅ GOOD - Early return saves work
const instances = trackClassInstances(j, root, 'ClassName');
if (instances.size === 0) return; // Exit immediately if nothing to do
```

```typescript
// ❌ BAD - Continues even when nothing to transform
const instances = trackClassInstances(j, root, 'ClassName');
root.find(j.CallExpression).forEach(/* ... */); // Runs even if instances is empty
```

## Common Pitfalls & Solutions

### Pitfall 1: Transforming Too Much

**Problem:** Your codemod transforms code from other packages with similar names.

**Example:**

```typescript
import { runExperiment } from '@mastra/core/evals'; // Should transform
import { runExperiment } from 'other-package'; // Should NOT transform
```

**Solution:** Track which package the import came from:

```typescript
// Track if imported from specific package
let wasImported = false;

root
  .find(j.ImportDeclaration)
  .filter(path => path.value.source.value === '@mastra/core/evals')
  .forEach(path => {
    // ... transform import
    wasImported = true;
  });

// Only transform usages if imported from our package
if (wasImported) {
  // ... transform usages
}
```

### Pitfall 2: Transforming Import Identifiers

**Problem:** When renaming function/type usages, you accidentally rename them in OTHER import statements.

**Example:**

```typescript
import { MastraMessageV2 } from '@mastra/core'; // Transform this
import { MastraMessageV2 } from 'other-package'; // DON'T transform this
```

**Solution:** Check parent type when transforming identifiers:

```typescript
root.find(j.Identifier, { name: oldName }).forEach(path => {
  // Skip identifiers that are part of import declarations
  const parent = path.parent;
  if (parent && parent.value.type === 'ImportSpecifier') {
    return;
  }

  path.value.name = newName;
});
```

### Pitfall 3: Not Tracking Instances

**Problem:** Transforming method calls on ANY object with that method name.

**Example:**

```typescript
const mastra = new Mastra();
mastra.getScorers(); // Should transform

const other = { getScorers: () => [] };
other.getScorers(); // Should NOT transform
```

**Solution:** Use the tracking utility:

```typescript
import { trackClassInstances } from '../lib/utils';

const mastraInstances = trackClassInstances(j, root, 'Mastra');

// Only transform if called on tracked instance
if (!mastraInstances.has(callee.object.name)) return false;
```

### Pitfall 4: Multiple Parameter Renames

**Problem:** Need to rename multiple parameters in the same call (e.g., `offset` → `page` AND `limit` → `perPage`).

**Solution:** Transform all properties in a single pass:

```typescript
args[0].properties?.forEach((prop: any) => {
  if ((prop.type === 'Property' || prop.type === 'ObjectProperty') && prop.key?.type === 'Identifier') {
    if (prop.key.name === 'offset') prop.key.name = 'page';
    if (prop.key.name === 'limit') prop.key.name = 'perPage';
  }
});
```

## Testing Best Practices

### 1. Always Include Negative Tests

Every codemod MUST include test cases that should NOT be transformed:

- Methods with same name on different objects
- Imports from different packages
- Different class instances

### 2. Test Multiple Occurrences

Include at least 2-3 instances of the pattern being transformed to ensure it works consistently.

### 3. Test Edge Cases

- Aliased imports: `import { OldName as Alias }`
- Type imports: `import type { OldName }`
- Mixed imports: `import { value, type Type }`

### 4. Base on Migration Guide

Always copy examples DIRECTLY from the migration guides. Don't invent examples.

## Quick Decision Tree

**What am I transforming?**

- **Method on specific class instances** → Use Pattern 1 (Method Rename on Tracked Instances)
- **Import path** → Use Pattern 2 (Import Path Transformation)
- **Function/value import + usages** → Use Pattern 3 (Import + Usage Rename)
- **TypeScript type import + usages** → Use Pattern 4 (Type Rename)
- **Property in method call args** → Use Pattern 5 (Property Rename in Method Calls)
- **Property in constructor** → Use Pattern 6 (Property Rename in Constructor)
- **Property access on context param** → Use Pattern 7 (Context Property Access Rename)
- **Positional arg → object param** → Use Pattern 8 (Positional to Object Parameter)

## File Structure Reference

```
packages/codemod/
├── src/
│   ├── codemods/
│   │   └── v1/
│   │       └── <codemod-name>.ts          # Implementation
│   ├── test/
│   │   ├── __fixtures__/
│   │   │   ├── <codemod-name>.input.ts    # Before transformation
│   │   │   └── <codemod-name>.output.ts   # After transformation
│   │   └── <codemod-name>.test.ts         # Test file
│   └── lib/
│       └── bundle.ts                       # Auto-updated by scaffold
```

## Migration Guide Locations

Find transformation examples in:

```
docs/src/content/en/guides/migrations/upgrade-to-v1/
├── agent.mdx
├── client.mdx
├── evals.mdx
├── mastra.mdx
├── mcp.mdx
├── memory.mdx
├── processors.mdx
├── storage.mdx
├── tools.mdx
├── vectors.mdx
├── voice.mdx
└── workflows.mdx
```

## Common jscodeshift APIs

```typescript
// Find nodes
root.find(j.ImportDeclaration)
root.find(j.NewExpression, { callee: { type: 'Identifier', name: 'ClassName' } })
root.find(j.CallExpression)
root.find(j.MemberExpression)
root.find(j.Identifier, { name: 'varName' })

// Filter
.filter(path => condition)

// Transform
.forEach(path => {
  path.value.property.name = 'newName';
  context.hasChanges = true;
})

// Create nodes
j.objectExpression([...])
j.property('init', j.identifier('key'), valueNode)
j.identifier('name')
j.stringLiteral('value')

// AST node types to check
node.type === 'Identifier'
node.type === 'MemberExpression'
node.type === 'ObjectExpression'
node.type === 'Property' || node.type === 'ObjectProperty'
node.type === 'ImportSpecifier'
node.type === 'ArrowFunctionExpression'
node.type === 'FunctionExpression'
```

## Success Checklist

Before considering a codemod complete:

- [ ] Scaffold created successfully
- [ ] Input fixture based on migration guide examples
- [ ] Output fixture shows ONLY the intended changes
- [ ] Negative test cases included in fixtures
- [ ] Test fails initially (TDD)
- [ ] Codemod implementation follows appropriate pattern
- [ ] Specific test passes
- [ ] All tests pass (no regressions)
- [ ] Codemod has no TypeScript errors
- [ ] Implementation has clear comments explaining what it does
- [ ] Console message describes transformation clearly

## Example Session Output

```bash
$ pnpm scaffold memory-query-to-recall
# Created files...

$ pnpm test memory-query-to-recall
# FAIL - expected transformation not happening (GOOD - TDD)

# Implement codemod...

$ pnpm test memory-query-to-recall
# ✓ PASS - transformation working correctly

$ pnpm test
# ✓ All tests passing (no regressions)
```

## Remember

1. **Use shared utilities first** - Check `src/codemods/lib/utils.ts` before implementing
2. **Optimize for single passes** - Combine operations, add early returns
3. **Never use UPDATE_SNAPSHOT** - Fix the code, not the tests
4. **Always include negative tests** - Avoid false positives
5. **Base on migration guides** - Don't hallucinate transformations
6. **Track instances efficiently** - Use `trackClassInstances()` utility
7. **Check parent types** - Avoid transforming import identifiers
8. **Test thoroughly** - Multiple occurrences, edge cases, negative cases
9. **Follow TDD** - Test should fail first, then pass after implementation

## Utility Function Reference

Located in `src/codemods/lib/utils.ts`:

| Function                           | Purpose                           | Example Usage                                                      |
| ---------------------------------- | --------------------------------- | ------------------------------------------------------------------ |
| `trackClassInstances()`            | Track single class instantiations | `trackClassInstances(j, root, 'Mastra')`                           |
| `trackMultipleClassInstances()`    | Track multiple classes at once    | `trackMultipleClassInstances(j, root, ['Pg', 'Postgres'])`         |
| `renameMethod()`                   | Rename one method                 | `renameMethod(j, root, instances, 'old', 'new')`                   |
| `renameMethods()`                  | Rename multiple methods           | `renameMethods(j, root, instances, { old: 'new' })`                |
| `transformMethodCalls()`           | Generic method transformer        | `transformMethodCalls(j, root, instances, 'method', callback)`     |
| `renameImportAndUsages()`          | Import + usages in one pass       | `renameImportAndUsages(j, root, '@pkg', 'Old', 'New')`             |
| `transformConstructorProperties()` | Constructor property renames      | `transformConstructorProperties(j, root, 'Class', { old: 'new' })` |
| `transformObjectProperties()`      | Recursive property renames        | `transformObjectProperties(obj, { old: 'new' })`                   |

**Always check existing utilities before writing custom transformation logic!**
