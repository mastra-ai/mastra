import { Button } from '@/ds/components/Button/Button';
import { Icon } from '@/ds/icons/Icon';
import { InputField } from '@/components/ui/elements/form-fields/input-field';
import { useId } from 'react';

import { Plus, Trash } from 'lucide-react';
import { Txt } from '@/ds/components/Txt/Txt';

export type HeaderListFormItem = {
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
    <div className="space-y-4 rounded-lg border border-border1 p-4 bg-surface2">
      <Txt as="h2" variant="header-md" className="text-icon6">
        Headers
      </Txt>

      {headers.length > 0 && (
        <ul>
          {headers.map((header, index) => (
            <li key={index}>
              <HeaderListFormItem index={index} header={header} onRemove={() => onRemoveHeader(index)} />
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="light"
        className="w-full border-dashed"
        size="lg"
        onClick={() => onAddHeader({ name: '', value: '' })}
      >
        <Icon>
          <Plus />
        </Icon>
        Add Header
      </Button>
    </div>
  );
};

interface HeaderListFormItemProps {
  header: HeaderListFormItem;
  index: number;
  onRemove: () => void;
}

const HeaderListFormItem = ({ index, header, onRemove }: HeaderListFormItemProps) => {
  const nameId = useId();
  const valueId = useId();

  return (
    <div className="grid grid-cols-[1fr_1fr_auto] gap-4 items-end">
      <InputField
        id={nameId}
        name={`headers.${index}.name`}
        label="Name"
        placeholder="e.g. Authorization"
        required
        defaultValue={header.name}
      />

      <InputField
        id={valueId}
        name={`headers.${index}.value`}
        label="Value"
        placeholder="e.g. Bearer <token>"
        required
        defaultValue={header.value}
      />

      <Button type="button" variant="light" className="w-full" size="lg" onClick={onRemove}>
        <Icon>
          <Trash aria-label="Remove header" />
        </Icon>
      </Button>
    </div>
  );
};
