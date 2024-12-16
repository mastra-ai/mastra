'use client';

import { useRef, useState } from 'react';

import { Checkbox } from '@/components/ui/checkbox';

function CheckboxField({
  value,
  field,
  onChange,
  type,
}: {
  value?: string | boolean;
  onChange: any;
  field: any;
  type: 'boolean' | 'check';
}) {
  const [checked, setChecked] = useState<boolean>(() => (value === 'checked' || value === true ? true : false));

  const checkBoxRef = useRef(null);

  function handleChange(newVal: boolean) {
    setChecked(newVal);
    const checkVal = newVal ? 'checked' : 'unchecked';
    onChange({ key: field.name, value: type === 'check' ? checkVal : newVal });
  }

  return (
    <div className="flex h-[36px] w-full items-center justify-start" aria-label="Click Checkbox">
      <Checkbox checked={checked} onCheckedChange={handleChange} tabIndex={-1} ref={checkBoxRef} />
    </div>
  );
}

export default CheckboxField;
