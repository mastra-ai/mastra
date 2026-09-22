'use client';

import { Button } from '@mastra/playground-ui/components/Button';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { FieldBlock, fieldErrorId } from '@mastra/playground-ui/components/FormFieldBlocks';
import { Pencil, X, Check } from 'lucide-react';
import { DatasetFieldErrors } from '../dataset-field-errors';
import { DatasetItemScorerSelector } from './dataset-item-scorer-selector';

/** Schema validation error from API */
export interface SchemaValidationError {
  field: 'input' | 'groundTruth' | 'toolMocks';
  errors: Array<{ path: string; message: string }>;
}

/**
 * Editable form view for updating dataset item
 */
export interface EditModeContentProps {
  inputValue: string;
  setInputValue: (value: string) => void;
  groundTruthValue: string;
  setGroundTruthValue: (value: string) => void;
  metadataValue: string;
  setMetadataValue: (value: string) => void;
  trajectoryValue: string;
  setTrajectoryValue: (value: string) => void;
  toolMocksValue: string;
  setToolMocksValue: (value: string) => void;
  scorerOverrideEnabled: boolean;
  setScorerOverrideEnabled: (enabled: boolean) => void;
  selectedScorerIds: string[];
  setSelectedScorerIds: (scorerIds: string[]) => void;
  requestContextValue: string;
  setRequestContextValue: (value: string) => void;
  validationErrors: SchemaValidationError | null;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function EditModeContent({
  inputValue,
  setInputValue,
  groundTruthValue,
  setGroundTruthValue,
  metadataValue,
  setMetadataValue,
  trajectoryValue,
  setTrajectoryValue,
  toolMocksValue,
  setToolMocksValue,
  scorerOverrideEnabled,
  setScorerOverrideEnabled,
  selectedScorerIds,
  setSelectedScorerIds,
  requestContextValue,
  setRequestContextValue,
  validationErrors,
  onSave,
  onCancel,
  isSaving,
}: EditModeContentProps) {
  return (
    <>
      <div className="mb-4">
        <h3 className="text-heading flex items-center gap-2">
          <Pencil className="h-5 w-5" /> Edit Item
        </h3>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <FieldBlock.Label name="item-input" required>
            Input (JSON)
          </FieldBlock.Label>
          <CodeEditor
            id="input-item-input"
            aria-invalid={validationErrors?.field === 'input' ? true : undefined}
            aria-describedby={validationErrors?.field === 'input' ? fieldErrorId('item-input') : undefined}
            value={inputValue}
            onChange={setInputValue}
            showCopyButton={false}
            className="min-h-[120px]"
          />
          {validationErrors?.field === 'input' && (
            <DatasetFieldErrors name="item-input" field="input" errors={validationErrors.errors} />
          )}
        </div>

        <div className="space-y-2">
          <FieldBlock.Label name="item-ground-truth">Ground Truth (JSON, optional)</FieldBlock.Label>
          <CodeEditor
            id="input-item-ground-truth"
            aria-invalid={validationErrors?.field === 'groundTruth' ? true : undefined}
            aria-describedby={validationErrors?.field === 'groundTruth' ? fieldErrorId('item-ground-truth') : undefined}
            value={groundTruthValue}
            onChange={setGroundTruthValue}
            showCopyButton={false}
            className="min-h-[100px]"
          />
          {validationErrors?.field === 'groundTruth' && (
            <DatasetFieldErrors name="item-ground-truth" field="groundTruth" errors={validationErrors.errors} />
          )}
        </div>

        <div className="space-y-2">
          <FieldBlock.Label name="item-trajectory">Expected Trajectory (JSON, optional)</FieldBlock.Label>
          <CodeEditor
            id="input-item-trajectory"
            value={trajectoryValue}
            onChange={setTrajectoryValue}
            showCopyButton={false}
            className="min-h-[80px]"
          />
        </div>

        <div className="space-y-2">
          <FieldBlock.Label name="item-tool-mocks">Tool Mocks (JSON array, optional)</FieldBlock.Label>
          <p className="text-muted-foreground text-caption">
            Ordered static mocks served in place of executing the tool. Each entry is{' '}
            <code>{`{ "toolName", "args", "output" }`}</code>. Calling a mocked tool with non-matching args fails the
            item; unmocked tools run live.
          </p>
          <CodeEditor
            id="input-item-tool-mocks"
            aria-invalid={validationErrors?.field === 'toolMocks' ? true : undefined}
            aria-describedby={validationErrors?.field === 'toolMocks' ? fieldErrorId('item-tool-mocks') : undefined}
            value={toolMocksValue}
            onChange={setToolMocksValue}
            showCopyButton={false}
            className="min-h-[100px]"
          />
          {validationErrors?.field === 'toolMocks' && (
            <DatasetFieldErrors name="item-tool-mocks" field="toolMocks" errors={validationErrors.errors} />
          )}
        </div>

        <DatasetItemScorerSelector
          overrideEnabled={scorerOverrideEnabled}
          onOverrideEnabledChange={setScorerOverrideEnabled}
          selectedScorerIds={selectedScorerIds}
          onSelectedScorerIdsChange={setSelectedScorerIds}
          disabled={isSaving}
        />

        <div className="space-y-2">
          <FieldBlock.Label name="item-request-context">Request Context (JSON, optional)</FieldBlock.Label>
          <CodeEditor
            id="input-item-request-context"
            value={requestContextValue}
            onChange={setRequestContextValue}
            showCopyButton={false}
            className="min-h-[80px]"
          />
        </div>

        <div className="space-y-2">
          <FieldBlock.Label name="item-metadata">Metadata (JSON, optional)</FieldBlock.Label>
          <CodeEditor
            id="input-item-metadata"
            value={metadataValue}
            onChange={setMetadataValue}
            showCopyButton={false}
            className="min-h-[80px]"
          />
        </div>

        <div className="flex gap-2 pt-4">
          <Button icon={<Check />} variant="primary" onClick={onSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button icon={<X />} onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
        </div>
      </div>
    </>
  );
}
