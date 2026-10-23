import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { cn } from '@/lib/utils';

export type TimePickerProps = {
  defaultValue?: string;
  onValueChange: (value: string) => void;
  className?: string;
  label?: string;
};

const hourOptions = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
const minuteOptions = ['00', '15', '30', '45', '59'];
const timePeriodOptions = ['AM', 'PM'];

export function TimePicker({ defaultValue, onValueChange, className, label = 'Time' }: TimePickerProps) {
  const [hour, setHour] = useState<string>('12');
  const [minute, setMinute] = useState<string>('00');
  const [timePeriod, setTimePeriod] = useState('AM');

  useEffect(() => {
    if (defaultValue) {
      const timeRegex = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)?$/;
      const match = defaultValue.match(timeRegex);

      if (match) {
        const rawHour = match[1];
        const rawMinute = match[2];
        if (rawHour === undefined || rawMinute === undefined) return;

        let parsedHour = parseInt(rawHour, 10);
        const parsedMinute = parseInt(rawMinute, 10);
        const period = match[3]?.toUpperCase();

        if (parsedHour >= 1 && parsedHour <= 12 && parsedMinute >= 0 && parsedMinute <= 59) {
          setHour(parsedHour.toString());
          setMinute(parsedMinute === 0 ? '00' : parsedMinute.toString());
          setTimePeriod(period || 'AM');
        }
      }
    }
  }, [defaultValue]);

  const handleHourChange = (val: string) => {
    const nextHour = hourOptions[+val];
    if (nextHour === undefined) return;
    setHour(nextHour);
    onValueChange(`${nextHour}:${minute} ${timePeriod}`.trim());
  };

  const handleMinuteChange = (val: string) => {
    const nextMinute = minuteOptions[+val];
    if (nextMinute === undefined) return;
    setMinute(nextMinute);
    onValueChange(`${hour}:${nextMinute} ${timePeriod}`.trim());
  };

  const handleTimePeriodChange = (val: string) => {
    const nextPeriod = timePeriodOptions[+val];
    if (nextPeriod === undefined) return;
    setTimePeriod(nextPeriod);
    onValueChange(`${hour}:${minute} ${nextPeriod}`.trim());
  };

  return (
    <div role="group" aria-label={label} className={cn('flex items-center gap-2', className)}>
      <TimePartSelect label="Hour" options={hourOptions} value={hour} onValueChange={handleHourChange} />
      :
      <TimePartSelect label="Minute" options={minuteOptions} value={minute} onValueChange={handleMinuteChange} />
      <TimePartSelect
        label="AM or PM"
        options={timePeriodOptions}
        value={timePeriod}
        onValueChange={handleTimePeriodChange}
      />
    </div>
  );
}

type TimePartSelectProps = {
  label: string;
  options: readonly string[];
  value: string;
  onValueChange: (index: string) => void;
};

function TimePartSelect({ label, options, value, onValueChange }: TimePartSelectProps) {
  return (
    <Select value={options.indexOf(value).toString()} onValueChange={onValueChange}>
      <SelectTrigger size="sm" aria-label={label}>
        <SelectValue placeholder="Select..." />
      </SelectTrigger>
      <SelectContent>
        {options.map((option, idx) => (
          <SelectItem key={option} value={`${idx}`}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
