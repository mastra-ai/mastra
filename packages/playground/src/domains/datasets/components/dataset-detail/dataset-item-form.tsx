'use client';

import { Button } from '@mastra/playground-ui/components/Button';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { Label } from '@mastra/playground-ui/components/Label';
import { Pencil } from 'lucide-react';

/** Schema validation error from API */
export interface SchemaValidationError {
  field: 'input' | 'groundTruth' | 'toolMocks';
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
  trajectoryValue: string;
  setTrajectoryValue: (value: string) => void;
  toolMocksValue: string;
  setToolMocksValue: (value: string) => void;
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
          <Label>Expected Trajectory (JSON, optional)</Label>
          <CodeEditor
            value={trajectoryValue}
            onChange={setTrajectoryValue}
            showCopyButton={false}
            className="min-h-[80px]"
          />
        </div>

        <div className="space-y-2">
          <Label>Tool Mocks (JSON array, optional)</Label>
          <p className="text-xs text-muted-foreground">
            Ordered static mocks served in place of executing the tool. Each entry is{' '}
            <code>{`{ "toolName", "args", "output" }`}</code>. Calling a mocked tool with non-matching args fails the
            item; unmocked tools run live.
          </p>
          <CodeEditor
            value={toolMocksValue}
            onChange={setToolMocksValue}
            showCopyButton={false}
            className="min-h-[100px]"
          />
          {validationErrors?.field === 'toolMocks' && (
            <ValidationErrors field="toolMocks" errors={validationErrors.errors} />
          )}
        </div>

        <div className="space-y-2">
          <Label>Request Context (JSON, optional)</Label>
          <CodeEditor
            value={requestContextValue}
            onChange={setRequestContextValue}
            showCopyButton={false}
            className="min-h-[80px]"
          />
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
          <Button variant="primary" onClick={onSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
        </div>
      </div>
    </>
  );
}
