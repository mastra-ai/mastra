import { useEffect, useState } from 'react';
import { Select } from '../select';
import { cn } from '@/lib/utils';

type TimePickerProps = {
  // value: string;
  defaultValue?: string;
  onValueChange: (value: string) => void;
  defaultMode?: '12h' | '24h';
  className?: string;
};

const hourOptions = {
  '12h': ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
  '24h': [
    '00',
    '01',
    '02',
    '03',
    '04',
    '05',
    '06',
    '07',
    '08',
    '09',
    '10',
    '11',
    '12',
    '13',
    '14',
    '15',
    '16',
    '17',
    '18',
    '19',
    '20',
    '21',
    '22',
    '23',
  ],
};

const minuteOptions = ['00', '15', '30', '45', '59'];
const timePeriodOptions = ['AM', 'PM'];

export function TimePicker({ defaultValue, onValueChange, defaultMode = '12h', className }: TimePickerProps) {
  const [hour, setHour] = useState<string>('12');
  const [minute, setMinute] = useState<string>('00');
  const [timePeriod, setTimePeriod] = useState('AM');
  const [mode, setMode] = useState(defaultMode);

  useEffect(() => {
    if (defaultValue) {
      // Parse time string - support formats like "13:45", "1:45 PM", "1:45PM", "13:45:30"
      const timeRegex = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)?$/;
      const match = defaultValue.match(timeRegex);

      if (match) {
        let parsedHour = parseInt(match[1], 10);
        const parsedMinute = parseInt(match[2], 10);
        const period = match[3]?.toUpperCase();

        // Validate hour and minute ranges
        if (parsedHour >= 0 && parsedHour <= 23 && parsedMinute >= 0 && parsedMinute <= 59) {
          // Handle 12-hour format
          if (period) {
            // Convert to 24-hour for internal processing
            if (period === 'PM' && parsedHour !== 12) {
              parsedHour += 12;
            } else if (period === 'AM' && parsedHour === 12) {
              parsedHour = 0;
            }

            // Set mode to 12h if period is provided
            setMode('12h');

            // Convert back to 12-hour format for display
            let displayHour = parsedHour;
            let displayPeriod = 'AM';

            if (parsedHour === 0) {
              displayHour = 12;
            } else if (parsedHour > 12) {
              displayHour = parsedHour - 12;
              displayPeriod = 'PM';
            } else if (parsedHour === 12) {
              displayPeriod = 'PM';
            }

            setHour(displayHour.toString());
            setTimePeriod(displayPeriod);
          } else {
            // 24-hour format
            setMode('24h');
            setHour(parsedHour.toString().padStart(2, '0'));
            setTimePeriod('AM'); // Default for 24h mode
          }

          // Set minute (find closest match in minuteOptions)
          const minuteIndex = minuteOptions.findIndex(option => parseInt(option) >= parsedMinute);
          const finalMinuteIndex = minuteIndex >= 0 ? minuteIndex : minuteOptions.length - 1;
          setMinute(minuteOptions[finalMinuteIndex]);
        }
      }
    }
  }, [defaultValue]);

  const handleHourChange = (val: string) => {
    setHour(hourOptions[mode][+val]);
    onValueChange(`${hourOptions[mode][+val]}:${minute} ${mode === '12h' ? timePeriod : ''}`.trim());
  };

  const handleMinuteChange = (val: string) => {
    setMinute(minuteOptions[+val]);
    onValueChange(`${hour}:${minuteOptions[+val]} ${mode === '12h' ? timePeriod : ''}`.trim());
  };

  const handleTimePeriodChange = (val: string) => {
    setTimePeriod(timePeriodOptions[+val]);
    onValueChange(`${hour}:${minute} ${timePeriodOptions[+val]}`.trim());
  };

  return (
    <div className={cn('flex gap-[0.5rem] items-center', className)}>
      <Select name="hour" value={hour} onChange={handleHourChange} options={hourOptions[mode]} /> :
      <Select name="minute" value={minute} onChange={handleMinuteChange} options={minuteOptions} />
      <Select name="period" value={timePeriod} onChange={handleTimePeriodChange} options={timePeriodOptions} />
    </div>
  );
}
