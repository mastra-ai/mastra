'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/ds/components/Dialog';
import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { Label } from '@/ds/components/Label';
import { toast } from '@/lib/toast';
import { useDatasetMutations } from '../hooks/use-dataset-mutations';
import { SchemaConfigSection } from './schema-config-section';

export interface CreateDatasetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (datasetId: string) => void;
}

export function CreateDatasetDialog({ open, onOpenChange, onSuccess }: CreateDatasetDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inputSchema, setInputSchema] = useState<Record<string, unknown> | null>(null);
  const [groundTruthSchema, setGroundTruthSchema] = useState<Record<string, unknown> | null>(null);
  const { createDataset } = useDatasetMutations();

  const handleSchemaChange = (schemas: {
    inputSchema: Record<string, unknown> | null;
    outputSchema: Record<string, unknown> | null;
  }) => {
    setInputSchema(schemas.inputSchema);
    setGroundTruthSchema(schemas.outputSchema);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Dataset name is required');
      return;
    }

    try {
      const result = (await createDataset.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        inputSchema,
        groundTruthSchema,
      })) as { id: string };

      toast.success('Dataset created successfully');

      // Reset form
      setName('');
      setDescription('');
      setInputSchema(null);
      setGroundTruthSchema(null);
      onOpenChange(false);

      // Navigate to new dataset
      onSuccess?.(result.id);
    } catch (error) {
      toast.error(`Failed to create dataset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCancel = () => {
    setName('');
    setDescription('');
    setInputSchema(null);
    setGroundTruthSchema(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Dataset</DialogTitle>
        </DialogHeader>
        <DialogBody className="max-h-[70vh] overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dataset-name">Name *</Label>
              <Input
                id="dataset-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter dataset name"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataset-description">Description</Label>
              <Input
                id="dataset-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Enter dataset description (optional)"
              />
            </div>

            <SchemaConfigSection
              inputSchema={inputSchema}
              outputSchema={groundTruthSchema}
              onChange={handleSchemaChange}
              disabled={createDataset.isPending}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="standard" size="default" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" variant="cta" size="default" disabled={createDataset.isPending || !name.trim()}>
                {createDataset.isPending ? 'Creating...' : 'Create Dataset'}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
