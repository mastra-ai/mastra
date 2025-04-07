import { AutoFormFieldProps } from '@autoform/react';
import { v4 as uuid } from '@lukeed/uuid';
import { Plus, TrashIcon } from 'lucide-react';
import * as React from 'react';
import { Button } from '../../button';
import { Input } from '../../input';

interface KeyValuePair {
  id: string;
  key: string;
  value: string;
}

export const RecordField: React.FC<AutoFormFieldProps> = ({ inputProps, error, id }) => {
  const { key, value = {}, onChange, ...props } = inputProps;
  const [pairs, setPairs] = React.useState<KeyValuePair[]>(() =>
    Object.entries(value).map(([key, val]) => ({
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
    <div className="space-y-3">
      {pairs.map(pair => (
        <div key={pair.id} className="relative space-y-2 rounded-lg border p-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2"
            onClick={() => removePair(pair.id)}
          >
            <TrashIcon className="h-4 w-4" />
          </Button>

          <div className="space-y-2 pt-6">
            <Input
              placeholder="Key"
              value={pair.key}
              onChange={e => handleChange(pair.id, 'key', e.target.value)}
              onBlur={handleBlur}
            />
            <Input
              placeholder="Value"
              value={pair.value}
              onChange={e => handleChange(pair.id, 'value', e.target.value)}
              onBlur={handleBlur}
            />
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-full" onClick={addPair}>
        <Plus className="mr-2 h-4 w-4" />
        Add Key-Value Pair
      </Button>
    </div>
  );
};
