'use client';

import { Label } from '@/ds/components/Label';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { Section } from '@/domains/cms';
import { BranchIcon } from '@/ds/icons';

// Re-export for consumers
export { extractPartialNames } from './template-utils';

interface PartialsEditorProps {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  detectedNames: string[];
}

export function PartialsEditor({ value, onChange, detectedNames }: PartialsEditorProps) {
  const handlePartialChange = (name: string, content: string) => {
    onChange({ ...value, [name]: content });
  };

  return (
    <Section
      title={<Section.Title icon={<BranchIcon className="text-accent5" />}>Partials</Section.Title>}
      className="pb-4"
    >
      <div className="flex flex-col gap-3">
        <p className="text-ui-xs text-icon3">Partials detected from your instructions. Define their content below.</p>

        {detectedNames.map(name => (
          <div key={name} className="flex flex-col gap-1.5 p-3 bg-surface2 rounded-md border border-border1">
            <Label className="text-ui-xs text-icon5 font-mono">
              {'{{>'} {name} {'}}'}
            </Label>
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
