import type { AutoFormFieldProps } from '@autoform/react';
import { v4 as uuid } from '@lukeed/uuid';
import { Plus, TrashIcon } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';

interface KeyValuePair {
  id: string;
  key: string;
  value: string;
}

export const RecordField: React.FC<AutoFormFieldProps> = ({ inputProps, field }) => {
  const { onChange } = inputProps;
  const [pairs, setPairs] = React.useState<KeyValuePair[]>(() =>
    Object.entries(field.default || {}).map(([key, val]) => ({
      id: key || uuid(),
      key,
      value: val as string,
    })),
  );

  React.useEffect(() => {
    if (pairs.length === 0) {
      setPairs([{ id: uuid(), key: '', value: '' }]);
    }
  }, [pairs]);

  const updateForm = React.useCallback(
    (newPairs: KeyValuePair[]) => {
      const newValue = newPairs.reduce(
        (acc, pair) => {
          if (pair.key) {
            acc[pair.key] = pair.value;
          }
          return acc;
        },
        {} as Record<string, string>,
      );

      onChange?.({
        target: { value: newValue, name: inputProps.name },
      });
    },
    [onChange, inputProps.name],
  );

  const handleChange = (id: string, field: 'key' | 'value', newValue: string) => {
    setPairs(prev => prev.map(pair => (pair.id === id ? { ...pair, [field]: newValue } : pair)));
  };

  const handleBlur = () => {
    updateForm(pairs);
  };

  const addPair = () => {
    const newPairs = [...pairs, { id: uuid(), key: '', value: '' }];
    setPairs(newPairs);
    updateForm(newPairs);
  };

  const removePair = (id: string) => {
    const newPairs = pairs.filter(p => p.id !== id);
    if (newPairs.length === 0) {
      newPairs.push({ id: uuid(), key: '', value: '' });
    }
    setPairs(newPairs);
    updateForm(newPairs);
  };

  return (
    <div className="grid gap-2">
      {pairs.map(pair => (
        // One row per pair: the field already sits in the form's surface, so no card of its own.
        <div key={pair.id} className="flex items-center gap-2">
          <Input
            placeholder="Key"
            className="flex-1"
            aria-label="Key"
            value={pair.key}
            onChange={e => handleChange(pair.id, 'key', e.target.value)}
            onBlur={handleBlur}
          />
          <Input
            placeholder="Value"
            className="flex-1"
            aria-label="Value"
            value={pair.value}
            onChange={e => handleChange(pair.id, 'value', e.target.value)}
            onBlur={handleBlur}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-md"
            tooltip="Remove pair"
            aria-label="Remove pair"
            onClick={() => removePair(pair.id)}
          >
            <TrashIcon />
          </Button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={addPair} icon={<Plus />}>
        Add pair
      </Button>
    </div>
  );
};
