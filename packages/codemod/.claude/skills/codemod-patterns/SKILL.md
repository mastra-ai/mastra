This guide helps AI agents efficiently create codemods with optimal performance and consistency

Quick Reference: Scaffold, Create Fixtures, Run Failing Test, Implement, Verify

Always optimize for minimal AST traversals
Use shared functions src/codemods/lib/utils.ts
Combine multiple operations
early returns when no changes needed
Track instances once, reuse the Set

Available Utility Functions
trackClassInstances
trackMultipleClassInstances
renameMethod / renameMethods
transformMethodCalls
renameImportAndUsages
transformConstructorProperties
transformObjectProperties

1 Scaffold the Codemod
cd packages/codemod
pnpm scaffold <codemod-name>
Use the codemod name WITHOUT the v1/ prefix. scaffold script automatically adds it
Example pnpm scaffold evals-run-experiment NOT v1/evals-run-experiment
This creates
$ = codemod name
src/codemods/v1/$.ts implementation
src/test/$.test.ts
src/test/**fixtures**/$.input.ts
src/test/__fixtures__/$.output.ts
Updates src/lib/bundle.ts automatically

2 Test Fixtures

ALWAYS base fixtures on migration guide examples

Input Template
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

Output Template

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

Rules
ALWAYS include negative test cases
Copy examples DIRECTLY from guides
change what the migration guide says to change
Ensure negative test cases remain IDENTICAL both input output

3 TDD

pnpm test <codemod-name>
Test should FAIL showing difference between actual output unchanged and expected output

validates
fixtures are correct
test infrastructure works
proper understanding

4 Implementation

Patterns
A. Method Rename on Tracked Instances (Using Utils)
usecase Rename specific class instance methods (Mastra Workflow Memory Agent Storage etc)

Example mastra.getScorers() → mastra.listScorers()

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

For multiple renames
import { trackClassInstances, renameMethods } from '../lib/utils';
const instances = trackClassInstances(j, root, 'Agent');
if (instances.size === 0) return;
const count = renameMethods(j, root, instances, {
generateVNext: 'generate',
streamVNext: 'stream',
});

B. Import Path Transformation
usecase Change import paths
Example @mastra/evals/scorers/llm → @mastra/evals/scorers/prebuilt

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

C. Import Rename Using Utils

usecase Rename both import and all usages of identifier
Example runExperiment → runEvals

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

D. Type Rename

Example MastraMessageV2 → MastraDBMessage

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

E. Method Calls Property Rename

Example memory.recall({ vectorMessageSearch }) → memory.recall({ vectorSearchString })

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

F. Constructor Property Rename

Example PostgresStore schema → schemaName

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

multiple property renames

const count = transformConstructorProperties(j, root, 'ClassName', {
oldProp1: 'newProp1',
oldProp2: 'newProp2',
oldProp3: 'newProp3',
});

F. Context Property Access Rename in specific function types

Example context.runCount → context.retryCount in step execution

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

G. Positional to Object constructor Parameter

Example new PgVector(connectionString) → new PgVector({ connectionString })

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

H. Verify

pnpm test <codemod-name>

Test should PASS with message showing transformation

Run all tests
pnpm test

All tests should pass, including your new one

If fail
DO NOT UPDATE_SNAPSHOT to force tests to pass
DO NOT modify fixtures to match incorrect output unless made genuine error in fixture
Fix codemod implementation instead
Review test output carefully to understand

Performance Guidelines

Use Shared Utilities

GOOD Uses utility 1 pass
import { trackClassInstances, renameMethods } from '../lib/utils';
const instances = trackClassInstances(j, root, 'Agent');
if (instances.size === 0) return;
renameMethods(j, root, instances, { oldMethod: 'newMethod' });

BAD Manual implementation 2 passes
const instances = new Set<string>();
root.find(j.NewExpression).forEach(path => collectInstance(path));
root.find(j.CallExpression).forEach(path => renameCall(path));

Combine Operations

GOOD Single pass
root.find(j.CallExpression).forEach(path => {
// Check all conditions inline
if (callee.type !== 'MemberExpression') return;
if (!instances.has(callee.object.name)) return;
// Transform immediately
});

BAD Multiple passes
root.find(j.CallExpression).filter(path => shouldRename(path)).forEach(path => renameCall(path));

Add Early Returns

GOOD Early return saves work
const instances = trackClassInstances(j, root, 'ClassName');
if (instances.size === 0) return; // Exit immediately if nothing to do

BAD Continues even when nothing to transform
const instances = trackClassInstances(j, root, 'ClassName');
root.find(j.CallExpression).forEach(path => renameCall(path)); // Runs even if instances is empty

Pitfall 1 Transforming Too Much

Problem codemod transforms code from other packages with similar names

Example
import { runExperiment } from '@mastra/core/evals'; // Should transform
import { runExperiment } from 'other-package'; // Should NOT transform

Solution Track which package the import came from

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

Pitfall 2 Transforming Import Identifiers

Problem When renaming function/type usages, you accidentally rename them in OTHER import statements

Example
import { MastraMessageV2 } from '@mastra/core'; // Transform this
import { MastraMessageV2 } from 'other-package'; // DON'T transform this

Solution Check parent type when transforming identifiers:

root.find(j.Identifier, { name: oldName }).forEach(path => {
// Skip identifiers that are part of import declarations
const parent = path.parent;
if (parent && parent.value.type === 'ImportSpecifier') {
return;
}
path.value.name = newName;
});

Pitfall 3 Not Tracking Instances

Problem Transforming method calls on ANY object with that method name

Example
const mastra = new Mastra();
mastra.getScorers(); // Should transform

const other = { getScorers: () => [] };
other.getScorers(); // Should NOT transform

Solution Use the tracking utility

import { trackClassInstances } from '../lib/utils';
const mastraInstances = trackClassInstances(j, root, 'Mastra');
// Only transform if called on tracked instance
if (!mastraInstances.has(callee.object.name)) return false;

Pitfall 4 Multiple Parameter Renames
Problem Need to rename multiple parameters in the same call (e.g., offset → page AND limit → perPage)
Solution Transform all properties in a single pass:

args[0].properties?.forEach((prop: any) => {
if ((prop.type === 'Property' || prop.type === 'ObjectProperty') && prop.key?.type === 'Identifier') {
if (prop.key.name === 'offset') prop.key.name = 'page';
if (prop.key.name === 'limit') prop.key.name = 'perPage';
}
});

Always Include Negative Tests
Every codemod MUST include test cases that should NOT be transformed:
Methods with same name on different objects
Imports from different packages
Different class instances

Include at least 2-3 instances of the pattern being transformed to ensure it works consistently
Test Edge Cases
import { OldName as Alias }
import type { OldName }
import { value, type Type }

Always copy examples DIRECTLY from the migration guides. Don't invent examples

Quick Decision Tree

Method on specific class instances Use Pattern 1 Method Rename on Tracked Instances
Import path Use Pattern 2 Import Path Transformation
Function/value import + usages Use Pattern 3 Import + Usage Rename
TypeScript type import + usages Use Pattern 4 Type Rename
Property in method call args Use Pattern 5 Property Rename in Method Calls
Property in constructor Use Pattern 6 Property Rename in Constructor
Property access on context param Use Pattern 7 Context Property Access Rename
Positional arg object param Use Pattern 8 Positional to Object Parameter

File Structure Reference

packages/codemod/
src/
─ codemods/
└── v1/
└── <codemod-name>.ts
─ test/
├── **fixtures**/
│ ├── <codemod-name>.input.ts
│ └── <codemod-name>.output.ts
└── <codemod-name>.test.ts
─ lib/
─ bundle.ts # Auto-updated

Migration Guide Locations

docs/src/content/en/guides/migrations/upgrade-to-v1/
agent.mdx
client.mdx
evals.mdx
mastra.mdx
mcp.mdx
memory.mdx
processors.mdx
storage.mdx
tools.mdx
vectors.mdx
voice.mdx
workflows.mdx

Common jscodeshift APIs

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

Success Checklist
Scaffold created successfully
Input fixture based on migration guide examples
Output fixture shows ONLY the intended changes
Negative test cases included in fixtures
Test fails initially (TDD)
Codemod implementation follows appropriate pattern
Specific test passes
All tests pass (no regressions)
Codemod has no TypeScript errors
Implementation has clear comments explaining what it does
Console message describes transformation clearly

Example Session Output

pnpm scaffold memory-query-to-recall
Created files...
pnpm test memory-query-to-recall
FAIL - expected transformation not happening (GOOD - TDD)
Implement codemod...
pnpm test memory-query-to-recall
PASS - transformation working correctly
pnpm test
All tests passing (no regressions)
