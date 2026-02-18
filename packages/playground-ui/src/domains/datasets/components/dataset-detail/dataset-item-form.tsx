'use client';

import { Button } from '@/ds/components/Button';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { Label } from '@/ds/components/Label';
import { Pencil } from 'lucide-react';

/** Schema validation error from API */
export interface SchemaValidationError {
  field: 'input' | 'groundTruth';
  errors: Array<{ path: string; message: string }>;
}

/** Displays field-level validation errors */
function ValidationErrors({ field, errors }: { field: string; errors: Array<{ path: string; message: string }> }) {
  if (!errors.length) return null;

  return (
    <div className="mt-2 space-y-1">
      {errors.map((err, idx) => (
        <p key={idx} className="text-xs text-destructive">
          <code className="bg-destructive/10 px-1 rounded">
            {field}
            {err.path !== '/' ? err.path : ''}
          </code>
          : {err.message}
        </p>
      ))}
    </div>
  );
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
  validationErrors,
  onSave,
  onCancel,
  isSaving,
}: EditModeContentProps) {
  return (
    <>
      <div className="mb-4">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Pencil className="w-5 h-5" /> Edit Item
        </h3>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label>Input (JSON) *</Label>
          <CodeEditor value={inputValue} onChange={setInputValue} showCopyButton={false} className="min-h-[120px]" />
          {validationErrors?.field === 'input' && <ValidationErrors field="input" errors={validationErrors.errors} />}
        </div>

        <div className="space-y-2">
          <Label>Ground Truth (JSON, optional)</Label>
          <CodeEditor
            value={groundTruthValue}
            onChange={setGroundTruthValue}
            showCopyButton={false}
            className="min-h-[100px]"
          />
          {validationErrors?.field === 'groundTruth' && (
            <ValidationErrors field="groundTruth" errors={validationErrors.errors} />
          )}
        </div>

        <div className="space-y-2">
          <Label>Metadata (JSON, optional)</Label>
          <CodeEditor
            value={metadataValue}
            onChange={setMetadataValue}
            showCopyButton={false}
            className="min-h-[80px]"
          />
        </div>

        <div className="flex gap-2 pt-4">
          <Button variant="cta" size="default" onClick={onSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button variant="standard" size="default" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
        </div>
      </div>
    </>
  );
}
