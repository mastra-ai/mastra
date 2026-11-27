import { formatLogLineTimestamp } from '@/utils/date-format';
import type { FractionDigits } from '@/utils/date-format';

const WIDEST_TIME = new Date(2000, 11, 28, 23, 59, 59, 999);

export function LogStreamColumnSizer({ fractionDigits = 2 }: { fractionDigits?: FractionDigits }) {
  const parts = formatLogLineTimestamp(WIDEST_TIME, { fractionDigits });
  return (
    <div
      aria-hidden
      className="invisible col-span-full grid h-0 grid-cols-subgrid gap-x-4 overflow-hidden px-3 font-mono text-body-sm tabular-nums"
    >
      <span>{parts && `${parts.day} ${parts.time}${parts.fraction}`}</span>
      <span className="uppercase">error</span>
      <span />
    </div>
  );
}
