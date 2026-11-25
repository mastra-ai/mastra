import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldError } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { TrashIcon } from '@mastra/playground-ui/icons/TrashIcon';

export type HeaderListFormItem = {
  /** A stable key for the row; without it rows are keyed by position, so removing one shifts the inputs below it. */
  id?: number;
  name: string;
  value: string;
};

export interface HeaderListFormProps {
  headers: Array<HeaderListFormItem>;
  onAddHeader: (header: HeaderListFormItem) => void;
  onRemoveHeader: (index: number) => void;
}

export const HeaderListForm = ({ headers, onAddHeader, onRemoveHeader }: HeaderListFormProps) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <Txt as="h2" variant="label" tone="ink">
            Headers
          </Txt>
          <Txt variant="caption" tone="muted">
            Sent with every request.
          </Txt>
        </div>
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          onClick={() => onAddHeader({ name: '', value: '' })}
          icon={<IconPlusMedium />}
        >
          Add header
        </Button>
      </div>

      {headers.length > 0 && (
        <ul className="flex flex-col gap-2">
          {headers.map((header, index) => (
            <li key={header.id ?? index}>
              <HeaderListFormItem index={index} header={header} onRemove={() => onRemoveHeader(index)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

interface HeaderListFormItemProps {
  header: HeaderListFormItem;
  index: number;
  onRemove: () => void;
}

const HeaderListFormItem = ({ index, header, onRemove }: HeaderListFormItemProps) => (
  <div className="flex items-start gap-2">
    <Field className="flex-1">
      <Input
        aria-label="Header name"
        name={`headers.${index}.name`}
        placeholder="Authorization"
        spellCheck={false}
        required
        defaultValue={header.name}
      />
      <FieldError />
    </Field>

    <Field className="flex-1">
      <Input
        aria-label="Header value"
        name={`headers.${index}.value`}
        placeholder="Bearer <token>"
        spellCheck={false}
        required
        defaultValue={header.value}
      />
      <FieldError />
    </Field>

    <Button
      size="icon-md"
      type="button"
      variant="ghost"
      onClick={onRemove}
      aria-label="Remove header"
      tooltip="Remove header"
    >
      <TrashIcon />
    </Button>
  </div>
);
