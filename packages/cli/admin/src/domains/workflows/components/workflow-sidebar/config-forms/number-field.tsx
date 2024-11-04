'use client';

import { useState } from 'react';

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
  const [value, setValue] = useState(props.field?.value || '');
  return (
    <Input
      {...props.field}
      type="number"
      value={value || ''}
      onChange={e => {
        const numericValue = e.target.value.replace(/\D/g, '');
        setValue(numericValue);
        props.field.onChange({ ...e, target: { ...e.target, value: numericValue } });
      }}
      id={props.field.name}
      onBlur={e => handleBlur(e, props.onBlur, props.isNullable)}
      className="input"
    />
  );
}

export default NumberField;
