import { useEffect, useMemo, useState } from 'react';

import { CodeEditor } from '@/ds/components/CodeEditor';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/ds/components/Dialog';
import type { JsonSchema } from '@/lib/json-schema';
import { isEligible } from '@/lib/rule-engine';
import { generateDefaultValues, interpolateTemplate } from '@/lib/template';
import { cn } from '@/lib/utils';

import type { InstructionBlock } from './utils/form-validation';

interface InstructionsPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blocks: InstructionBlock[];
  variablesSchema?: JsonSchema;
}

export function InstructionsPreviewDialog({
  open,
  onOpenChange,
  blocks,
  variablesSchema,
}: InstructionsPreviewDialogProps) {
  const defaultValues = useMemo(() => generateDefaultValues(variablesSchema), [variablesSchema]);

  const [variablesJson, setVariablesJson] = useState('{}');

  // Reset JSON to defaults when dialog opens or schema changes
  useEffect(() => {
    if (open) {
      setVariablesJson(JSON.stringify(defaultValues, null, 2));
    }
  }, [open, defaultValues]);

  const { compiledInstructions, parseError } = useMemo(() => {
    if (!open) return { compiledInstructions: '', parseError: null };

    try {
      const variables = JSON.parse(variablesJson || '{}') as Record<string, unknown>;

      // Filter blocks by eligibility based on their rules
      const eligibleBlocks = blocks.filter(block =>
        block.rules.length > 0 ? isEligible(block.rules, variables) : true,
      );

      // Join eligible block contents
      const joinedInstructions = eligibleBlocks.map(b => b.content).join('\n\n');

      return {
        compiledInstructions: interpolateTemplate(joinedInstructions, variables),
        parseError: null,
      };
    } catch {
      // Fallback: show all blocks without filtering when JSON is invalid
      return {
        compiledInstructions: blocks.map(b => b.content).join('\n\n'),
        parseError: 'Invalid JSON',
      };
    }
  }, [blocks, variablesJson, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Visualize Instructions</DialogTitle>
          <DialogDescription>Preview how variables are replaced in your instructions</DialogDescription>
        </DialogHeader>
        <div className="flex-1 grid grid-cols-2 gap-4 min-h-0 px-6 pb-6">
          {/* Left: JSON Editor for variables */}
          <div className="flex flex-col gap-2 min-h-0">
            <label className={cn('text-sm font-medium text-neutral5', parseError && 'text-accent2')}>
              Variable Values {parseError && `(${parseError})`}
            </label>
            <CodeEditor
              value={variablesJson}
              onChange={setVariablesJson}
              language="json"
              showCopyButton={false}
              className={cn('flex-1 min-h-0', parseError && 'border-accent2')}
            />
          </div>

          {/* Right: Compiled Instructions Preview */}
          <div className="flex flex-col gap-2 min-h-0">
            <label className="text-sm font-medium text-neutral5">Compiled Instructions</label>
            <CodeEditor
              value={compiledInstructions}
              language="markdown"
              showCopyButton
              highlightVariables
              wordWrap
              className="flex-1 min-h-0"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
