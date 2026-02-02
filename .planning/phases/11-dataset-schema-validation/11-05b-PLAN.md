---
phase: 11-dataset-schema-validation
plan: 05b
type: execute
wave: 3
depends_on: ['11-05a']
files_modified:
  - packages/playground-ui/src/domains/datasets/components/schema-settings/schema-field.tsx
  - packages/playground-ui/src/domains/datasets/components/schema-settings/schema-settings-dialog.tsx
  - packages/playground-ui/src/domains/datasets/components/schema-settings/index.ts
  - packages/playground-ui/src/domains/datasets/components/dataset-detail/dataset-header.tsx
autonomous: true

must_haves:
  truths:
    - 'User can open schema settings dialog from dataset header'
    - 'User can enable/disable input schema independently'
    - 'User can enable/disable output schema independently'
    - 'User can edit schema JSON directly'
    - 'Saving schema shows validation errors if existing items fail'
  artifacts:
    - path: 'packages/playground-ui/src/domains/datasets/components/schema-settings/schema-field.tsx'
      provides: 'Schema field with toggle, editor, and import'
      exports: ['SchemaField']
    - path: 'packages/playground-ui/src/domains/datasets/components/schema-settings/schema-settings-dialog.tsx'
      provides: 'Dialog for managing dataset schemas'
      exports: ['SchemaSettingsDialog']
  key_links:
    - from: 'packages/playground-ui/src/domains/datasets/components/dataset-detail/dataset-header.tsx'
      to: 'packages/playground-ui/src/domains/datasets/components/schema-settings/schema-settings-dialog.tsx'
      via: 'Schema Settings menu item opens dialog'
      pattern: 'SchemaSettingsDialog'
---

<objective>
Create SchemaField component and SchemaSettingsDialog, integrate into DatasetHeader menu.

Purpose: Enable users to configure schema validation on datasets through the UI.
Output: Schema settings dialog with enable/disable toggles, JSON editor, and workflow import.

NOTE: This plan satisfies success criterion #8 ("Users cannot enable or modify a schema if existing
items would fail validation") through API-level enforcement. When the user clicks Save with a schema
that would invalidate existing items, the API returns SchemaUpdateValidationError which is displayed
in the dialog as a clear error message. The user must then either adjust the schema or fix the items.
</objective>

<execution_context>
@/Users/yj/.claude/get-shit-done/workflows/execute-plan.md
@/Users/yj/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/11-dataset-schema-validation/11-RESEARCH.md
@.planning/phases/11-dataset-schema-validation/11-05a-SUMMARY.md
@packages/playground-ui/src/domains/datasets/components/dataset-detail/dataset-header.tsx
@packages/playground-ui/src/domains/datasets/hooks/use-datasets.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create SchemaField component</name>
  <files>
    packages/playground-ui/src/domains/datasets/components/schema-settings/schema-field.tsx
    packages/playground-ui/src/domains/datasets/components/schema-settings/index.ts
  </files>
  <action>
1. Create packages/playground-ui/src/domains/datasets/components/schema-settings/schema-field.tsx:
   ```typescript
   import { useState, useEffect } from 'react';
   import { Switch } from '@/ds/components/Switch';
   import { CodeEditor } from '@/ds/components/CodeEditor';
   import { WorkflowSchemaImport } from './workflow-schema-import';
   import { cn } from '@/lib/utils';

interface SchemaFieldProps {
label: string;
schemaType: 'input' | 'output';
value: Record<string, unknown> | null | undefined;
onChange: (schema: Record<string, unknown> | null) => void;
error?: string;
}

export function SchemaField({
label,
schemaType,
value,
onChange,
error,
}: SchemaFieldProps) {
const isEnabled = value !== null && value !== undefined;
const [jsonText, setJsonText] = useState(() =>
value ? JSON.stringify(value, null, 2) : ''
);
const [parseError, setParseError] = useState<string | null>(null);

     // Sync jsonText when value changes from outside (e.g., import)
     useEffect(() => {
       if (value) {
         setJsonText(JSON.stringify(value, null, 2));
         setParseError(null);
       }
     }, [value]);

     const handleToggle = (checked: boolean) => {
       if (checked) {
         // Enable with default empty object schema
         onChange({ type: 'object', properties: {} });
       } else {
         // Disable by setting null
         onChange(null);
       }
     };

     const handleJsonChange = (text: string) => {
       setJsonText(text);
       try {
         const parsed = JSON.parse(text);
         if (typeof parsed === 'object' && parsed !== null) {
           setParseError(null);
           onChange(parsed);
         } else {
           setParseError('Schema must be a JSON object');
         }
       } catch (e) {
         setParseError('Invalid JSON');
       }
     };

     const handleImport = (schema: Record<string, unknown>) => {
       onChange(schema);
       setJsonText(JSON.stringify(schema, null, 2));
       setParseError(null);
     };

     return (
       <div className="space-y-3">
         <div className="flex items-center justify-between">
           <div className="flex items-center gap-2">
             <Switch
               checked={isEnabled}
               onCheckedChange={handleToggle}
               id={`${schemaType}-schema-toggle`}
             />
             <label
               htmlFor={`${schemaType}-schema-toggle`}
               className="text-sm font-medium"
             >
               {label}
             </label>
           </div>

           {isEnabled && (
             <WorkflowSchemaImport schemaType={schemaType} onImport={handleImport} />
           )}
         </div>

         {isEnabled && (
           <div className="space-y-2">
             <CodeEditor
               value={jsonText}
               onChange={handleJsonChange}
               language="json"
               className={cn(
                 'h-48 border rounded-md',
                 (parseError || error) && 'border-destructive'
               )}
             />
             {parseError && (
               <p className="text-xs text-destructive">{parseError}</p>
             )}
             {error && !parseError && (
               <p className="text-xs text-destructive">{error}</p>
             )}
           </div>
         )}
       </div>
     );

}

````

2. Update packages/playground-ui/src/domains/datasets/components/schema-settings/index.ts:
```typescript
export { WorkflowSchemaImport } from './workflow-schema-import';
export { SchemaField } from './schema-field';
````

  </action>
  <verify>
    - `pnpm typecheck` passes
    - SchemaField renders toggle, editor, and import controls
    - JSON parsing errors show inline
    - Toggle enables/disables schema
  </verify>
  <done>SchemaField component with toggle, JSON editor, and import integration</done>
</task>

<task type="auto">
  <name>Task 2: Create SchemaSettingsDialog and integrate into DatasetHeader</name>
  <files>
    packages/playground-ui/src/domains/datasets/components/schema-settings/schema-settings-dialog.tsx
    packages/playground-ui/src/domains/datasets/components/schema-settings/index.ts
    packages/playground-ui/src/domains/datasets/components/dataset-detail/dataset-header.tsx
  </files>
  <action>
1. Create packages/playground-ui/src/domains/datasets/components/schema-settings/schema-settings-dialog.tsx:
   ```typescript
   import { useState, useEffect } from 'react';
   import { Dialog } from '@/ds/components/Dialog';
   import { Button } from '@/ds/components/Button';
   import { SchemaField } from './schema-field';
   import { useDatasetMutations } from '../../hooks/use-dataset-mutations';
   import { toast } from '@/lib/toast';

interface SchemaSettingsDialogProps {
open: boolean;
onOpenChange: (open: boolean) => void;
datasetId: string;
initialInputSchema?: Record<string, unknown> | null;
initialOutputSchema?: Record<string, unknown> | null;
}

export function SchemaSettingsDialog({
open,
onOpenChange,
datasetId,
initialInputSchema,
initialOutputSchema,
}: SchemaSettingsDialogProps) {
const [inputSchema, setInputSchema] = useState<Record<string, unknown> | null>(
initialInputSchema ?? null
);
const [outputSchema, setOutputSchema] = useState<Record<string, unknown> | null>(
initialOutputSchema ?? null
);
const [validationError, setValidationError] = useState<{
input?: string;
output?: string;
general?: string;
}>({});

     const { updateDataset } = useDatasetMutations();

     // Reset state when dialog opens
     useEffect(() => {
       if (open) {
         setInputSchema(initialInputSchema ?? null);
         setOutputSchema(initialOutputSchema ?? null);
         setValidationError({});
       }
     }, [open, initialInputSchema, initialOutputSchema]);

     const handleSave = async () => {
       setValidationError({});

       try {
         await updateDataset.mutateAsync({
           id: datasetId,
           inputSchema,
           outputSchema,
         });
         toast.success('Schema settings saved');
         onOpenChange(false);
       } catch (err: any) {
         // Handle SchemaUpdateValidationError from API
         // This enforces success criterion #8: users cannot enable schema if items fail
         if (err?.cause?.failingItems) {
           const failingItems = err.cause.failingItems;
           const count = failingItems.length;
           setValidationError({
             general: `${count} existing item(s) fail validation. Fix items or adjust schema.`,
           });
         } else {
           setValidationError({
             general: err.message || 'Failed to update schema',
           });
         }
       }
     };

     return (
       <Dialog open={open} onOpenChange={onOpenChange}>
         <Dialog.Content className="max-w-2xl">
           <Dialog.Header>
             <Dialog.Title>Schema Settings</Dialog.Title>
             <Dialog.Description>
               Configure JSON Schema validation for dataset items.
               Imported schemas are copied and can be modified.
             </Dialog.Description>
           </Dialog.Header>

           <div className="space-y-6 py-4">
             <SchemaField
               label="Input Schema"
               schemaType="input"
               value={inputSchema}
               onChange={setInputSchema}
               error={validationError.input}
             />

             <SchemaField
               label="Expected Output Schema"
               schemaType="output"
               value={outputSchema}
               onChange={setOutputSchema}
               error={validationError.output}
             />

             {validationError.general && (
               <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                 <p className="text-sm text-destructive">{validationError.general}</p>
               </div>
             )}
           </div>

           <Dialog.Footer>
             <Button variant="outline" onClick={() => onOpenChange(false)}>
               Cancel
             </Button>
             <Button onClick={handleSave} disabled={updateDataset.isPending}>
               {updateDataset.isPending ? 'Saving...' : 'Save'}
             </Button>
           </Dialog.Footer>
         </Dialog.Content>
       </Dialog>
     );

}

````

2. Update packages/playground-ui/src/domains/datasets/components/schema-settings/index.ts:
```typescript
export { WorkflowSchemaImport } from './workflow-schema-import';
export { SchemaField } from './schema-field';
export { SchemaSettingsDialog } from './schema-settings-dialog';
````

3. Update packages/playground-ui/src/domains/datasets/components/dataset-detail/dataset-header.tsx:

   Add "Schema Settings" option to three-dot menu:

   ```typescript
   import { useState } from 'react';
   import { SchemaSettingsDialog } from '../schema-settings';

   // In component:
   const [schemaDialogOpen, setSchemaDialogOpen] = useState(false);

   // In three-dot menu items array, add:
   {
     label: 'Schema Settings',
     icon: 'settings',
     onClick: () => setSchemaDialogOpen(true),
   }

   // In JSX, add dialog:
   <SchemaSettingsDialog
     open={schemaDialogOpen}
     onOpenChange={setSchemaDialogOpen}
     datasetId={datasetId}
     initialInputSchema={dataset?.inputSchema}
     initialOutputSchema={dataset?.outputSchema}
   />
   ```

   Make sure to pass dataset prop to DatasetHeader or fetch it via hook.
   </action>
   <verify> - `pnpm typecheck` passes - `pnpm build` succeeds - Schema Settings option appears in dataset header menu - Dialog shows input/output schema fields with toggles - Import from workflow works - Saving shows validation error if items fail (criterion #8)
   </verify>
   <done>SchemaSettingsDialog created and integrated into DatasetHeader menu</done>
   </task>

</tasks>

<verification>
1. `cd packages/playground-ui && pnpm build` succeeds
2. Dataset header three-dot menu has "Schema Settings" option
3. Dialog shows input schema and output schema fields
4. Toggle enables/disables each schema independently
5. Import from workflow populates schema JSON
6. Saving with incompatible existing items shows error message
</verification>

<success_criteria>

- User can open Schema Settings from dataset header menu
- User can enable/disable input and output schemas independently
- User can import schema from any registered workflow
- Imported schemas appear in JSON editor and can be modified
- Save validates existing items and shows clear error if validation fails (success criterion #8)
  </success_criteria>

<output>
After completion, create `.planning/phases/11-dataset-schema-validation/11-05b-SUMMARY.md`
</output>
