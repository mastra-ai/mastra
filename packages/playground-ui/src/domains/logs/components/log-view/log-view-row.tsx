import type { LogViewLine } from '../../types';
import type { useDataListKeyboard } from '@/ds/components/DataList';
import { LogStream } from '@/ds/components/LogStream';
import type { FractionDigits } from '@/utils/date-format';

type RowKeyboardProps = ReturnType<ReturnType<typeof useDataListKeyboard>['getRowProps']>;

export interface LogViewRowProps<T extends LogViewLine> {
  log: T;
  index: number;
  featured: boolean;
  wrap: boolean;
  timeFractionDigits?: FractionDigits;
  measureRef: (node: Element | null) => void;
  keyboardProps: RowKeyboardProps;
  onLogClick?: (log: T) => void;
}

export function LogViewRow<T extends LogViewLine>({
  log,
  index,
  featured,
  wrap,
  timeFractionDigits,
  measureRef,
  keyboardProps,
  onLogClick,
}: LogViewRowProps<T>) {
  const line = (
    <LogStream.Line
      timestamp={log.timestamp}
      fractionDigits={timeFractionDigits}
      level={log.level}
      icon={log.icon}
      message={log.message}
      fields={log.data ?? undefined}
      wrap={wrap}
      collapse={onLogClick !== undefined}
    />
  );

  if (!onLogClick) {
    return (
      <LogStream.Row ref={measureRef} data-index={index} level={log.level}>
        {line}
      </LogStream.Row>
    );
  }

  return (
    <LogStream.RowButton
      ref={measureRef}
      data-index={index}
      {...keyboardProps}
      level={log.level}
      featured={featured}
      onClick={() => onLogClick(log)}
    >
      {line}
    </LogStream.RowButton>
  );
}
