import {
  Entity,
  EntityContent,
  EntityName,
  EntityDescription,
  EntityHeader,
  EntityBody,
} from '@mastra/playground-ui/components/Entity';
import { Field, FieldDescription, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { useEmbedders } from '@mastra/react/hooks/embedders';
import { useVectors } from '@mastra/react/hooks/vectors';
import { Controller, useWatch } from 'react-hook-form';
import { useAgentEditFormContext } from '../../../context/agent-edit-form-context';

export function SemanticRecallEntity() {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;
  const semanticRecallEnabled = useWatch({ control, name: 'memory.semanticRecall' }) ?? false;

  const { data: vectorsData } = useVectors();
  const { data: embeddersData } = useEmbedders();
  const vectors = vectorsData?.vectors ?? [];
  const embedders = embeddersData?.embedders ?? [];

  return (
    <Entity variant="section">
      <EntityHeader>
        <EntityContent>
          <EntityName>Semantic Recall</EntityName>
          <EntityDescription>Enable semantic search in memory</EntityDescription>
        </EntityContent>

        {!readOnly && (
          <Controller
            name="memory.semanticRecall"
            control={control}
            render={({ field }) => <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />}
          />
        )}
      </EntityHeader>

      {semanticRecallEnabled && (
        <EntityBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Controller
            name="memory.vector"
            control={control}
            render={({ field }) => (
              <Field className="gap-1.5">
                <FieldLabel>Vector Store</FieldLabel>
                <FieldDescription className="mt-0 text-placeholder">
                  Select a vector store for semantic search
                </FieldDescription>
                <Select value={field.value ?? ''} onValueChange={field.onChange} disabled={readOnly}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a vector store" />
                  </SelectTrigger>
                  <SelectContent>
                    {vectors.map(vector => (
                      <SelectItem key={vector.id} value={vector.id}>
                        {vector.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />

          <Controller
            name="memory.embedder"
            control={control}
            render={({ field }) => (
              <Field className="gap-1.5">
                <FieldLabel>Embedder Model</FieldLabel>
                <FieldDescription className="mt-0 text-placeholder">
                  Select an embedding model for semantic search
                </FieldDescription>
                <Select value={field.value ?? ''} onValueChange={field.onChange} disabled={readOnly}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an embedder model" />
                  </SelectTrigger>
                  <SelectContent>
                    {embedders.map(embedder => (
                      <SelectItem key={embedder.id} value={embedder.id}>
                        {embedder.name} ({embedder.provider})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
        </EntityBody>
      )}
    </Entity>
  );
}
