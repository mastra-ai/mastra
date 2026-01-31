'use client';

import { useState, useMemo, useEffect } from 'react';
import Handlebars from 'handlebars';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/ds/components/Dialog';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { extractVariableNames } from './template-utils';

interface TestInstructionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instructions: string;
  partials: Record<string, string>;
}

export function TestInstructionDialog({ open, onOpenChange, instructions, partials }: TestInstructionDialogProps) {
  // Extract variables from instructions
  const variableNames = useMemo(() => extractVariableNames(instructions), [instructions]);

  // Initialize variables state when dialog opens or variableNames change
  const [variables, setVariables] = useState<Record<string, string>>(() =>
    Object.fromEntries(variableNames.map(name => [name, ''])),
  );

  // Update variables when variableNames change
  useEffect(() => {
    setVariables(prev => {
      const newVariables: Record<string, string> = {};
      for (const name of variableNames) {
        newVariables[name] = prev[name] ?? '';
      }
      return newVariables;
    });
  }, [variableNames]);

  // Compile template with variables and partials
  const compiledOutput = useMemo(() => {
    try {
      // Register partials
      Object.entries(partials).forEach(([name, content]) => {
        Handlebars.registerPartial(name, content);
      });

      const template = Handlebars.compile(instructions);
      return template(variables);
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }, [instructions, partials, variables]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[80vw] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Test Instructions</DialogTitle>
          <DialogDescription className="not-sr-only text-sm text-icon3">
            Preview how your instruction template renders with sample data. Pass these values via requestContext to
            dynamically compute agent instructions at runtime.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 flex-1 min-h-0">
          {/* Left: Variables JSON Editor */}
          <div className="flex flex-col gap-2 min-h-0 px-6 pb-6">
            <span className="text-sm text-icon5">Variables (JSON)</span>
            <CodeEditor
              value={JSON.stringify(variables, null, 2)}
              onChange={val => {
                try {
                  setVariables(JSON.parse(val || '{}'));
                } catch {
                  /* ignore parse errors while typing */
                }
              }}
              language="json"
              showCopyButton={false}
              className="flex-1 min-h-[300px]"
            />
          </div>

          {/* Right: Compiled Output */}
          <div className="flex flex-col min-h-0 p-6 bg-surface2 border-l border-border1">
            <CodeEditor value={compiledOutput} language="markdown" showCopyButton={true} className="flex-1 min-h-[300px]" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
