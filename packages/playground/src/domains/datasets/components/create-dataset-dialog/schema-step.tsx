import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import {
  DialogAction,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { SchemaConfigSection } from '../schema-config-section';
import type { DatasetSchemas } from './dataset-schemas';

export interface SchemaStepProps {
  schemas: DatasetSchemas;
  onSchemasChange: (schemas: DatasetSchemas) => void;
  onBack: () => void;
  onNext: () => void;
}

export function SchemaStep({ schemas, onSchemasChange, onBack, onNext }: SchemaStepProps) {
  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <DialogTitle>Choose a schema</DialogTitle>
          <Badge size="sm">Optional</Badge>
        </div>
        <DialogDescription>
          Schemas validate the input and ground truth of every item. You can change them later.
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <SchemaConfigSection
          inputSchema={schemas.inputSchema}
          outputSchema={schemas.outputSchema}
          requestContextSchema={schemas.requestContextSchema}
          onChange={onSchemasChange}
          collapsible={false}
        />
      </DialogBody>
      <DialogFooter>
        <Button onClick={onBack}>Back</Button>
        <DialogAction onConfirm={onNext}>Next</DialogAction>
      </DialogFooter>
    </>
  );
}
