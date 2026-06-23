import { useMemo } from 'react';

import { EnvironmentVariablesEditorReadOnlyListContext } from './environment-variables-editor-context';
import { EnvironmentVariablesEditorReadOnlyHeader } from './environment-variables-editor-read-only-header';
import type { EnvironmentVariablesEditorReadOnlyListProps } from './environment-variables-editor.types';
import { DataList } from '@/ds/components/DataList/data-list';
import { cn } from '@/lib/utils';

const READ_ONLY_COLUMNS = 'minmax(12rem,1.4fr) minmax(8rem,0.9fr) minmax(8rem,auto)';
const READ_ONLY_COLUMNS_WITH_ICON = `auto ${READ_ONLY_COLUMNS}`;

export function EnvironmentVariablesEditorReadOnlyList({
  className,
  children,
  columns,
  header,
  showHeader = true,
  showIcon = false,
  nameLabel,
  valueLabel,
  updatedAtLabel,
  variant = 'lined',
  scrollRef,
  ...props
}: EnvironmentVariablesEditorReadOnlyListProps) {
  const resolvedColumns = columns ?? (showIcon ? READ_ONLY_COLUMNS_WITH_ICON : READ_ONLY_COLUMNS);
  const contextValue = useMemo(() => ({ showIcon }), [showIcon]);

  return (
    <EnvironmentVariablesEditorReadOnlyListContext.Provider value={contextValue}>
      <DataList
        columns={resolvedColumns}
        variant={variant}
        scrollRef={scrollRef}
        className={cn('min-h-0', className)}
        {...props}
      >
        {showHeader &&
          (header ?? (
            <EnvironmentVariablesEditorReadOnlyHeader
              nameLabel={nameLabel}
              valueLabel={valueLabel}
              updatedAtLabel={updatedAtLabel}
            />
          ))}
        {children}
      </DataList>
    </EnvironmentVariablesEditorReadOnlyListContext.Provider>
  );
}

