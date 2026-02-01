'use client';

import { Label } from '@/ds/components/Label';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { SectionHeader } from '@/domains/cms';
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
    <section className="flex flex-col gap-3 pb-4">
      <SectionHeader
        title="Partials"
        subtitle={
          <>
            Reusable template fragments. Referenced with{' '}
            <span className="font-mono" style={{ color: '#ffb86c' }}>
              {'{{>name}}'}
            </span>{' '}
            in your instructions.
          </>
        }
        icon={<BranchIcon className="text-accent5" />}
      />

      {detectedNames.map(name => (
        <div key={name} className="flex flex-col gap-1.5 p-3 bg-surface2 rounded-md border border-border1">
          <Label className="text-ui-sm font-mono font-medium" style={{ color: '#ffb86c' }}>
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
    </section>
  );
}
