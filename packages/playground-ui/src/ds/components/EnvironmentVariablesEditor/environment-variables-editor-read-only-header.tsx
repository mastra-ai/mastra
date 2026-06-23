import { use } from 'react';

import { EnvironmentVariablesEditorReadOnlyListContext } from './environment-variables-editor-context';
import type { EnvironmentVariablesEditorReadOnlyHeaderProps } from './environment-variables-editor.types';
import { DataList } from '@/ds/components/DataList/data-list';

export function EnvironmentVariablesEditorReadOnlyHeader({
  className,
  nameLabel = 'Key',
  valueLabel = 'Value',
  updatedAtLabel = 'Last Updated',
  ...props
}: EnvironmentVariablesEditorReadOnlyHeaderProps) {
  const { showIcon } = use(EnvironmentVariablesEditorReadOnlyListContext);

  return (
    <DataList.Top className={className} {...props}>
      {showIcon && (
        <DataList.TopCell aria-hidden="true" className="justify-center">
          <span />
        </DataList.TopCell>
      )}
      <DataList.TopCell>{nameLabel}</DataList.TopCell>
      <DataList.TopCell>{valueLabel}</DataList.TopCell>
      <DataList.TopCell className="justify-end">{updatedAtLabel}</DataList.TopCell>
    </DataList.Top>
  );
}

