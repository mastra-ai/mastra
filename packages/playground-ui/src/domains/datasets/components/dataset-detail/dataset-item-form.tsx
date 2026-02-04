'use client';

import { Button } from '@/ds/components/Button';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { Label } from '@/ds/components/Label';
import { Pencil } from 'lucide-react';

/**
 * Editable form view for updating dataset item
 */
export interface EditModeContentProps {
  inputValue: string;
  setInputValue: (value: string) => void;
  expectedOutputValue: string;
  setExpectedOutputValue: (value: string) => void;
  metadataValue: string;
  setMetadataValue: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function EditModeContent({
  inputValue,
  setInputValue,
  expectedOutputValue,
  setExpectedOutputValue,
  metadataValue,
  setMetadataValue,
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
        </div>

        <div className="space-y-2">
          <Label>Expected Output (JSON, optional)</Label>
          <CodeEditor
            value={expectedOutputValue}
            onChange={setExpectedOutputValue}
            showCopyButton={false}
            className="min-h-[100px]"
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
          <Button variant="standard" size="default" onClick={onSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button variant="secondary" size="default" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
        </div>
      </div>
    </>
  );
}
