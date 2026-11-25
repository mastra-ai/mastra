import { Badge } from '@/ds/components/Badge';
import type { FractionDigits } from '@/utils/date-format';

function zoneName(date: Date, timeZone?: string) {
  return new Intl.DateTimeFormat(undefined, { timeZone, timeZoneName: 'short' })
    .formatToParts(date)
    .find(part => part.type === 'timeZoneName')?.value;
}

function splitFraction(formatter: Intl.DateTimeFormat, date: Date) {
  const parts = formatter.formatToParts(date);
  const fractionAt = parts.findIndex(part => part.type === 'fractionalSecond');
  if (fractionAt < 0) return { time: formatter.format(date), fraction: '', suffix: '' };
  const join = (from: number, to?: number) =>
    parts
      .slice(from, to)
      .map(part => part.value)
      .join('');
  return {
    time: join(0, fractionAt - 1),
    fraction: join(fractionAt - 1, fractionAt + 1),
    suffix: join(fractionAt + 1),
  };
}

function zoneRow(date: Date, timeZone?: string, fractionDigits?: FractionDigits) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: fractionDigits,
  });
  return {
    zone: zoneName(date, timeZone) ?? 'Local',
    day: new Intl.DateTimeFormat(undefined, { timeZone, month: 'short', day: 'numeric', year: 'numeric' }).format(date),
    ...splitFraction(formatter, date),
  };
}

export interface TimestampZonesProps {
  date: Date;
  fractionDigits?: FractionDigits;
}

export function TimestampZones({ date, fractionDigits }: TimestampZonesProps) {
  const local = zoneRow(date, undefined, fractionDigits);
  const rows = local.zone === 'UTC' ? [local] : [local, zoneRow(date, 'UTC', fractionDigits)];

  return (
    <table className="font-mono tabular-nums">
      <tbody>
        {rows.map(row => (
          <tr key={row.zone} className="[&+tr>td]:pt-1.5">
            <td className="pr-3">
              <Badge size="xs">{row.zone}</Badge>
            </td>
            <td className="pr-3">{row.day}</td>
            <td className="text-right">
              {row.time}
              <span className="text-muted-foreground">{row.fraction}</span>
              {row.suffix}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
