'use client';

import { Label } from '@/ds/components/Label';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { SectionHeader } from '@/domains/cms';
import { BranchIcon, Icon } from '@/ds/icons';

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
    <section className="flex flex-col gap-3 pb-4 px-4">
      <SectionHeader
        title={
          <>
            Partials{detectedNames.length > 0 && <span className="text-neutral3 font-normal"> ({detectedNames.length})</span>}
          </>
        }
        subtitle={
          <>
            Reusable template fragments. Referenced with{' '}
            <span className="font-mono" style={{ color: '#ffb86c' }}>
              {'{{>name}}'}
            </span>{' '}
            in your instructions.
          </>
        }
        icon={
          <Icon>
            <BranchIcon className="text-accent5" />
          </Icon>
        }
      />

      {detectedNames.map(name => (
        <div key={name} className="rounded-md border border-border1 bg-surface2">
          <div className="px-3 py-2 bg-surface3 border-b border-border1 rounded-t-md">
            <Label className="text-ui-sm font-mono font-medium" style={{ color: '#ffb86c' }}>
              {'{{>'} {name} {'}}'}
            </Label>
          </div>
          <CodeEditor
            value={value[name] || ''}
            onChange={val => handlePartialChange(name, val || '')}
            language="markdown"
            showCopyButton={false}
            placeholder={`Enter content for {{> ${name}}}...`}
            className="min-h-[80px] border-0 rounded-none bg-transparent"
          />
        </div>
      ))}
    </section>
  );
}
