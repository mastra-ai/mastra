'use client';

import { useEffect, useState } from 'react';

import { DatePicker } from '@/components/ui/date-picker';

function DateField({ value, field, onChange }: { value?: Date; onChange: any; field: any }) {
  const [date, setDate] = useState<Date | undefined | null>(value || new Date());

  function handleChange(newDate: Date | null | undefined) {
    setDate(newDate);
    onChange({ key: field.name, value: (newDate || new Date()).toISOString() });
  }

  useEffect(() => {
    onChange({ key: field.name, value: date?.toISOString() });
  }, []);

  return (
    <DatePicker
      value={date}
      setValue={handleChange}
      placeholder="date"
      className="h-[36px] w-full bg-transparent text-xs"
    />
  );
}

export default DateField;
