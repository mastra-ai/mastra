import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Plus, Trash } from 'lucide-react';

export type HeaderListFormItem = {
  name: string;
  value: string;
};

export interface HeaderListFormProps {
  headers: Array<HeaderListFormItem>;
  showHeading?: boolean;
  onAddHeader: (header: HeaderListFormItem) => void;
  onRemoveHeader: (index: number) => void;
}

export const HeaderListForm = ({ headers, onAddHeader, onRemoveHeader, showHeading = true }: HeaderListFormProps) => {
  return (
    <div className="space-y-4">
      {showHeading && (
        <Txt as="h2" variant="body" tone="ink">
          Headers
        </Txt>
      )}

      <div className="space-y-6">
        {headers.length > 0 && (
          <ul className="space-y-4">
            {headers.map((header, index) => (
              <li key={index}>
                <HeaderListFormItem index={index} header={header} onRemove={() => onRemoveHeader(index)} />
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-2">
          {headers.length === 0 && <Txt tone="muted">No header yet</Txt>}
          <Button
            type="button"
            onClick={() => onAddHeader({ name: '', value: '' })}
            size={headers.length === 0 ? 'md' : 'sm'}
            icon={<Plus />}
          >
            {headers.length === 0 ? 'Add Header' : 'Add Another Header'}
          </Button>
        </div>
      </div>
    </div>
  );
};

interface HeaderListFormItemProps {
  header: HeaderListFormItem;
  index: number;
  onRemove: () => void;
}

const HeaderListFormItem = ({ index, header, onRemove }: HeaderListFormItemProps) => (
  <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-4">
    <Field>
      <FieldLabel required>Name</FieldLabel>
      <Input name={`headers.${index}.name`} placeholder="e.g. Authorization" required defaultValue={header.name} />
      <FieldError />
    </Field>

    <Field>
      <FieldLabel required>Value</FieldLabel>
      <Input name={`headers.${index}.value`} placeholder="e.g. Bearer <token>" required defaultValue={header.value} />
      <FieldError />
    </Field>

    <Button type="button" onClick={onRemove} aria-label="Remove header" tooltip="Remove header">
      <Trash />
    </Button>
  </div>
);
