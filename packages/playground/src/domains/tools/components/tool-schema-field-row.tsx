import { Txt } from '@mastra/playground-ui/components/Txt';
import type { SchemaField } from '../utils/get-schema-fields';
import { RequiredMark } from './required-mark';

export interface ToolSchemaFieldRowProps {
  field: SchemaField;
}

export function ToolSchemaFieldRow({ field }: ToolSchemaFieldRowProps) {
  return (
    <li className="grid gap-1 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <Txt as="span" variant="body-sm" font="mono" tone="ink">
          {field.name}
          {field.required && <RequiredMark />}
        </Txt>
        <Txt as="span" variant="caption" font="mono" tone="muted">
          {field.type}
        </Txt>
      </div>
      {field.description && (
        <Txt variant="caption" tone="muted">
          {field.description}
        </Txt>
      )}
      {field.defaultValue !== undefined && (
        <Txt variant="caption" tone="faint">
          Default:{' '}
          <Txt as="span" variant="caption" font="mono">
            {field.defaultValue}
          </Txt>
        </Txt>
      )}
    </li>
  );
}
