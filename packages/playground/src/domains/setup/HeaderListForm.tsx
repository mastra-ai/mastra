import { InputField } from '@mastra/playground-ui';
import { useId } from 'react';
import { HeaderConfig } from './MastraInstanceUrlContext';

export interface HeaderListFormProps {
  headers: HeaderConfig[];
}

export const HeaderListForm = ({ headers }: HeaderListFormProps) => {
  return (
    <ul>
      {headers.map((header, index) => (
        <li key={index}>
          <HeaderListFormItem index={index} name={header.name} value={header.value} />
        </li>
      ))}
    </ul>
  );
};

interface HeaderListFormItemProps extends HeaderConfig {
  index: number;
}

const HeaderListFormItem = ({ index, name, value }: HeaderListFormItemProps) => {
  const nameId = useId();
  const valueId = useId();

  return (
    <div className="grid grid-cols-2 gap-2">
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
    </div>
  );
};
