import type { LogRecord } from '../../types';
import type { useDataListKeyboard } from '@/ds/components/DataList';
import { LogStream } from '@/ds/components/LogStream';

type RowKeyboardProps = ReturnType<ReturnType<typeof useDataListKeyboard>['getRowProps']>;

export interface LogViewRowProps {
  log: LogRecord;
  index: number;
  featured: boolean;
  wrap: boolean;
  measureRef: (node: Element | null) => void;
  keyboardProps: RowKeyboardProps;
  onLogClick?: (log: LogRecord) => void;
}

export function LogViewRow({ log, index, featured, wrap, measureRef, keyboardProps, onLogClick }: LogViewRowProps) {
  const line = (
    <LogStream.Line
      timestamp={log.timestamp}
      level={log.level}
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
