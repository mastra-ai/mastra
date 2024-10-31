'use client';

import { Input } from '@/components/ui/input';

function handleBlur(e: any, onBlur: any, isNullable: boolean) {
  const key = e.target.name;
  const value = e.target.value;
  if (isNullable) {
    onBlur({ key, value: value === '' || typeof value === undefined ? null : parseInt(value, 10) });
  } else {
    onBlur({ key, value: parseInt(value, 10) });
  }
}

function NumberField(props: any) {
  return (
    <Input
      {...props.field}
      type="number"
      id={props.field.name}
      onBlur={e => handleBlur(e, props.onBlur, props.isNullable)}
      className="input"
      defaultValue={null}
    />
  );
}

export default NumberField;
