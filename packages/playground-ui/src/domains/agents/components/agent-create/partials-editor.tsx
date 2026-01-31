'use client';

import { Trash2 } from 'lucide-react';

import { Label } from '@/ds/components/Label';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { IconButton } from '@/ds/components/IconButton';
import { Section } from '@/domains/cms';
import { BranchIcon } from '@/ds/icons';

// Re-export for consumers
export { extractPartialNames } from './template-utils';

interface PartialsEditorProps {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  partialNames: string[];
}

export function PartialsEditor({ value, onChange, partialNames }: PartialsEditorProps) {
  const handlePartialChange = (name: string, content: string) => {
    onChange({ ...value, [name]: content });
  };

  const handleDeletePartial = (name: string) => {
    const newValue = { ...value };
    delete newValue[name];
    onChange(newValue);
  };

  return (
    <Section
      title={<Section.Title icon={<BranchIcon className="text-accent5" />}>Partials</Section.Title>}
      className="pb-4"
    >
      <div className="flex flex-col gap-3">
        <p className="text-ui-xs text-icon3">Partials detected from your instructions. Define their content below.</p>

        {partialNames.map(name => (
          <div key={name} className="flex flex-col gap-1.5 p-3 bg-surface2 rounded-md border border-border1">
            <div className="flex items-center justify-between">
              <Label className="text-ui-xs text-icon5 font-mono">
                {'{{>'} {name} {'}}'}
              </Label>
              <IconButton
                type="button"
                variant="ghost"
                size="sm"
                tooltip="Delete partial"
                onClick={() => handleDeletePartial(name)}
              >
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
            <CodeEditor
              value={value[name] || ''}
              onChange={val => handlePartialChange(name, val || '')}
              language="markdown"
              showCopyButton={false}
              placeholder={`Enter content for {{> ${name}}}...`}
              className="min-h-[80px]"
            />
          </div>
        ))}
      </div>
    </Section>
  );
}
