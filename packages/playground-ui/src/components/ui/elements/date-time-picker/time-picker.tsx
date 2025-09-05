import { useEffect, useState } from 'react';
import { Select } from '../select';
import { cn } from '@/lib/utils';

type TimePickerProps = {
  defaultValue?: string;
  onValueChange: (value: string) => void;
  className?: string;
};

const hourOptions = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
const minuteOptions = ['00', '15', '30', '45', '59'];
const timePeriodOptions = ['AM', 'PM'];

export function TimePicker({ defaultValue, onValueChange, className }: TimePickerProps) {
  const [hour, setHour] = useState<string>('12');
  const [minute, setMinute] = useState<string>('00');
  const [timePeriod, setTimePeriod] = useState('AM');

  useEffect(() => {
    if (defaultValue) {
      const timeRegex = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)?$/;
      const match = defaultValue.match(timeRegex);

      if (match) {
        let parsedHour = parseInt(match[1], 10);
        const parsedMinute = parseInt(match[2], 10);
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
    setHour(val);
    onValueChange(`${hourOptions[+val]}:${minute} ${timePeriod}`.trim());
  };

  const handleMinuteChange = (val: string) => {
    setMinute(minuteOptions[+val]);
    onValueChange(`${hour}:${minuteOptions[+val]} ${timePeriod}`.trim());
  };

  const handleTimePeriodChange = (val: string) => {
    setTimePeriod(timePeriodOptions[+val]);
    onValueChange(`${hour}:${minute} ${timePeriodOptions[+val]}`.trim());
  };

  return (
    <div className={cn('flex gap-[0.5rem] items-center', className)}>
      <Select
        name="hour"
        value={hourOptions.indexOf(hour).toString()}
        onChange={handleHourChange}
        options={hourOptions}
      />
      :
      <Select
        name="minute"
        value={minuteOptions.indexOf(minute).toString()}
        onChange={handleMinuteChange}
        options={minuteOptions}
      />
      <Select
        name="period"
        value={timePeriodOptions.indexOf(timePeriod).toString()}
        onChange={handleTimePeriodChange}
        options={timePeriodOptions}
      />
    </div>
  );
}
