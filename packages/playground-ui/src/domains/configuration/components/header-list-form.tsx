import { Button } from '@/ds/components/Button/Button';
import { Icon } from '@/ds/icons/Icon';
import { InputField } from '@/ds/components/FormFields';
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
    <div className="space-y-4">
      <Txt as="h2" variant="header-md" className="text-neutral6">
        Headers
      </Txt>

      <div className="bg-surface4 rounded-lg p-4 border-sm border-border2 space-y-4">
        {headers.length > 0 && (
          <ul className="space-y-4">
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
          className="w-full border-dashed !bg-surface4 !border-border2 hover:!bg-surface5"
          size="lg"
          onClick={() => onAddHeader({ name: '', value: '' })}
        >
          <Icon>
            <Plus />
          </Icon>
          Add Header
        </Button>
      </div>
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

      <Button
        type="button"
        variant="light"
        className="w-full !bg-surface4 !border-border2 hover:!bg-surface5"
        size="lg"
        onClick={onRemove}
      >
        <Icon>
          <Trash aria-label="Remove header" />
        </Icon>
      </Button>
    </div>
  );
};
