---
phase: 11-dataset-schema-validation
plan: 05a
type: execute
wave: 3
depends_on: ['11-03']
files_modified:
  - packages/playground-ui/src/domains/datasets/hooks/use-workflow-schema.ts
  - packages/playground-ui/src/domains/datasets/components/schema-settings/workflow-schema-import.tsx
  - packages/playground-ui/src/domains/datasets/components/schema-settings/index.ts
autonomous: true

must_haves:
  truths:
    - 'useWorkflowSchema hook fetches workflow schema from API'
    - 'WorkflowSchemaImport shows workflow selector and import button'
    - 'Selecting workflow loads its schema'
    - 'Import button calls onImport with selected schema'
  artifacts:
    - path: 'packages/playground-ui/src/domains/datasets/hooks/use-workflow-schema.ts'
      provides: 'Hook to fetch workflow schema'
      exports: ['useWorkflowSchema']
    - path: 'packages/playground-ui/src/domains/datasets/components/schema-settings/workflow-schema-import.tsx'
      provides: 'Workflow selector for schema import'
      exports: ['WorkflowSchemaImport']
  key_links:
    - from: 'packages/playground-ui/src/domains/datasets/hooks/use-workflow-schema.ts'
      to: '/api/workflows/:workflowId/schema'
      via: 'client.get fetch'
      pattern: '/workflows/.*schema'
---

<objective>
Create useWorkflowSchema hook and WorkflowSchemaImport component.

Purpose: Enable importing schema definitions from registered workflows.
Output: Hook for fetching workflow schema, component for selecting workflow and triggering import.
</objective>

<execution_context>
@/Users/yj/.claude/get-shit-done/workflows/execute-plan.md
@/Users/yj/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/11-dataset-schema-validation/11-RESEARCH.md
@.planning/phases/11-dataset-schema-validation/11-03-SUMMARY.md
@packages/playground-ui/src/domains/datasets/hooks/use-datasets.ts
@packages/playground-ui/src/domains/workflows/hooks/use-workflows.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create useWorkflowSchema hook</name>
  <files>
    packages/playground-ui/src/domains/datasets/hooks/use-workflow-schema.ts
  </files>
  <action>
1. Create packages/playground-ui/src/domains/datasets/hooks/use-workflow-schema.ts:
   ```typescript
   import { useQuery } from '@tanstack/react-query';
   import { useMastraClient } from '@/lib/hooks/use-mastra-client';

interface WorkflowSchema {
inputSchema: Record<string, unknown> | null;
outputSchema: Record<string, unknown> | null;
}

export function useWorkflowSchema(workflowId: string | null) {
const client = useMastraClient();

     return useQuery<WorkflowSchema>({
       queryKey: ['workflow-schema', workflowId],
       queryFn: async () => {
         if (!workflowId) throw new Error('No workflow selected');
         // Use the client to fetch workflow schema
         return client.get(`/workflows/${encodeURIComponent(workflowId)}/schema`);
       },
       enabled: !!workflowId,
       staleTime: 5 * 60 * 1000, // Cache for 5 minutes
     });

}

````

2. Export from hooks index if exists, or ensure the file can be imported directly.
</action>
<verify>
 - `pnpm typecheck` passes in playground-ui
 - useWorkflowSchema returns data when workflowId is provided
 - Query is disabled when workflowId is null
</verify>
<done>useWorkflowSchema hook created for fetching workflow schemas</done>
</task>

<task type="auto">
<name>Task 2: Create WorkflowSchemaImport component and barrel export</name>
<files>
 packages/playground-ui/src/domains/datasets/components/schema-settings/workflow-schema-import.tsx
 packages/playground-ui/src/domains/datasets/components/schema-settings/index.ts
</files>
<action>
1. Create directory if not exists:
```bash
mkdir -p packages/playground-ui/src/domains/datasets/components/schema-settings
````

2. Create packages/playground-ui/src/domains/datasets/components/schema-settings/workflow-schema-import.tsx:

   ```typescript
   import { useState } from 'react';
   import { Button } from '@/ds/components/Button';
   import { Icon } from '@/ds/icons';
   import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';
   import { useWorkflowSchema } from '../../hooks/use-workflow-schema';
   import {
     Select,
     SelectTrigger,
     SelectContent,
     SelectItem,
     SelectValue,
   } from '@/ds/components/Select';

   interface WorkflowSchemaImportProps {
     schemaType: 'input' | 'output';
     onImport: (schema: Record<string, unknown>) => void;
   }

   export function WorkflowSchemaImport({ schemaType, onImport }: WorkflowSchemaImportProps) {
     const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
     const { data: workflows, isLoading: workflowsLoading } = useWorkflows();
     const { data: schema, isLoading: schemaLoading } = useWorkflowSchema(selectedWorkflow);

     const handleImport = () => {
       const schemaToImport = schemaType === 'input' ? schema?.inputSchema : schema?.outputSchema;
       if (schemaToImport) {
         onImport(schemaToImport);
         setSelectedWorkflow(null);
       }
     };

     const hasSchema = schemaType === 'input' ? schema?.inputSchema : schema?.outputSchema;

     return (
       <div className="flex items-center gap-2">
         <Select
           value={selectedWorkflow ?? ''}
           onValueChange={setSelectedWorkflow}
         >
           <SelectTrigger className="w-48">
             <SelectValue placeholder="Select workflow..." />
           </SelectTrigger>
           <SelectContent>
             {workflowsLoading ? (
               <SelectItem value="" disabled>Loading...</SelectItem>
             ) : (
               workflows?.map(wf => (
                 <SelectItem key={wf.id} value={wf.id}>
                   {wf.name || wf.id}
                 </SelectItem>
               ))
             )}
           </SelectContent>
         </Select>

         <Button
           size="sm"
           variant="outline"
           onClick={handleImport}
           disabled={!selectedWorkflow || schemaLoading || !hasSchema}
         >
           <Icon name="download" className="w-4 h-4 mr-1" />
           Import {schemaType}
         </Button>

         {selectedWorkflow && !schemaLoading && !hasSchema && (
           <span className="text-xs text-muted-foreground">
             No {schemaType} schema defined
           </span>
         )}
       </div>
     );
   }
   ```

3. Create packages/playground-ui/src/domains/datasets/components/schema-settings/index.ts:
   ```typescript
   export { WorkflowSchemaImport } from './workflow-schema-import';
   ```
     </action>
     <verify>
       - `pnpm typecheck` passes
       - WorkflowSchemaImport shows workflow selector
       - Import button is disabled until workflow selected and has schema
       - onImport is called with schema object on click
     </verify>
     <done>WorkflowSchemaImport component created with workflow selection and import button</done>
   </task>

</tasks>

<verification>
1. `cd packages/playground-ui && pnpm typecheck` passes
2. useWorkflowSchema hook fetches from /workflows/:id/schema
3. WorkflowSchemaImport shows workflow dropdown
4. Selecting workflow triggers schema fetch
5. Import button calls onImport with correct schema
</verification>

<success_criteria>

- useWorkflowSchema hook exists and fetches workflow schema
- WorkflowSchemaImport component renders workflow selector
- Import functionality works when schema available
- Proper loading states and disabled button handling
  </success_criteria>

<output>
After completion, create `.planning/phases/11-dataset-schema-validation/11-05a-SUMMARY.md`
</output>
