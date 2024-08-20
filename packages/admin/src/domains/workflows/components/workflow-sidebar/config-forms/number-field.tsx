'use client';

import { Input } from '@/components/ui/input';

function handleBlur(e: any, onBlur: any) {
  const key = e.target.name;
  const value = e.target.value;
  onBlur({ key, value: parseInt(value, 10) });
}

function NumberField(props: any) {
  return (
    <Input
      {...props.field}
      type="number"
      id={props.field.name}
      onBlur={e => handleBlur(e, props.onBlur)}
      className="input"
    />
  );
}

export default NumberField;
