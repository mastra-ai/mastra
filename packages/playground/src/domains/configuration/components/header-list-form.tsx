import { ButtonWithTooltip, Button, TextFieldBlock, Txt } from '@mastra/playground-ui';
import { Plus, Trash } from 'lucide-react';
import { useId } from 'react';

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
      <Txt as="h2" variant="header-xs" className="text-neutral6">
        Headers
      </Txt>

      <div className=" space-y-6">
        {headers.length > 0 && (
          <ul className="space-y-4">
            {headers.map((header, index) => (
              <li key={index}>
                <HeaderListFormItem index={index} header={header} onRemove={() => onRemoveHeader(index)} />
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-2 justify-between">
          {headers.length === 0 && <Txt className="text-neutral3">No header yet</Txt>}
          <Button
            type="button"
            onClick={() => onAddHeader({ name: '', value: '' })}
            size={headers.length === 0 ? 'md' : 'sm'}
            className=""
          >
            <Plus />
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

const HeaderListFormItem = ({ index, header, onRemove }: HeaderListFormItemProps) => {
  const nameId = useId();
  const valueId = useId();

  return (
    <div className="grid grid-cols-[1fr_1fr_auto] gap-4 items-end">
      <TextFieldBlock
        id={nameId}
        name={`headers.${index}.name`}
        label="Name"
        placeholder="e.g. Authorization"
        required
        defaultValue={header.name}
      />

      <TextFieldBlock
        id={valueId}
        name={`headers.${index}.value`}
        label="Value"
        placeholder="e.g. Bearer <token>"
        required
        defaultValue={header.value}
      />

      <ButtonWithTooltip type="button" onClick={onRemove} aria-label="Remove header" tooltipContent="Remove header">
        <Trash />
      </ButtonWithTooltip>
    </div>
  );
};
