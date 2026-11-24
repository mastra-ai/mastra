import type { ReactNode } from 'react';
import type { LogRecord } from '../types';
import type { useDataListKeyboard } from '@/ds/components/DataList';
import { LogsDataList } from '@/ds/components/LogsDataList';

type RowKeyboardProps = ReturnType<ReturnType<typeof useDataListKeyboard>['getRowProps']>;

export interface LogsListRowProps {
  log: LogRecord;
  index: number;
  featured: boolean;
  measureRef: (node: Element | null) => void;
  keyboardProps: RowKeyboardProps;
  onLogClick?: (log: LogRecord) => void;
  children: ReactNode;
}

export function LogsListRow({
  log,
  index,
  featured,
  measureRef,
  keyboardProps,
  onLogClick,
  children,
}: LogsListRowProps) {
  const variant = log.level === 'error' || log.level === 'fatal' ? 'error' : 'default';

  if (!onLogClick) {
    return (
      <LogsDataList.RowStatic ref={measureRef} data-index={index} featured={featured} variant={variant}>
        {children}
      </LogsDataList.RowStatic>
    );
  }

  return (
    <LogsDataList.RowButton
      ref={measureRef}
      data-index={index}
      {...keyboardProps}
      onClick={() => onLogClick(log)}
      featured={featured}
      variant={variant}
    >
      {children}
    </LogsDataList.RowButton>
  );
}
