import { Button, Icon, InputField, Txt } from '@mastra/playground-ui';
import { useId } from 'react';
import { HeaderConfig } from './MastraInstanceUrlContext';
import { Plus, Trash } from 'lucide-react';

export interface HeaderListFormProps {
  headers: HeaderConfig[];
  onAddHeader: (header: HeaderConfig) => void;
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
              <HeaderListFormItem
                index={index}
                name={header.name}
                value={header.value}
                onRemove={() => onRemoveHeader(index)}
              />
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

interface HeaderListFormItemProps extends HeaderConfig {
  index: number;
  onRemove: () => void;
}

const HeaderListFormItem = ({ index, name, value, onRemove }: HeaderListFormItemProps) => {
  const nameId = useId();
  const valueId = useId();

  return (
    <div className="grid grid-cols-[1fr_1fr_auto] gap-4 items-end">
      <InputField
        id={nameId}
        name={`headers.${index}.name`}
        label="Header Name"
        placeholder="Header Name"
        required
        defaultValue={name}
      />

      <InputField
        id={valueId}
        name={`headers.${index}.value`}
        label="Header Value"
        placeholder="Header Value"
        required
        defaultValue={value}
      />

      <Button type="button" variant="light" className="w-full" size="lg" onClick={onRemove}>
        <Icon>
          <Trash aria-label="Remove header" />
        </Icon>
      </Button>
    </div>
  );
};
