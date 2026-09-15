import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import type { ButtonProps } from '@/ds/components/Button';
import type { DataListNoMatchProps } from '@/ds/components/DataList/data-list-no-match';
import type { DataListRootProps } from '@/ds/components/DataList/data-list-root';
import type { DataListRowStaticProps } from '@/ds/components/DataList/data-list-row-static';
import type { DataListTopProps } from '@/ds/components/DataList/data-list-top';
import type { NoticeRootProps } from '@/ds/components/Notice';
import type { EnvironmentVariablesEditorController } from '@/hooks/use-environment-variables-editor';
import type { EnvironmentVariableEntry } from '@/lib/env-file';

export type EnvironmentVariablesEditorRowErrors = Record<number, { key?: ReactNode; value?: ReactNode }>;

export interface EnvironmentVariablesEditorRootProps<
  TRow extends EnvironmentVariableEntry = EnvironmentVariableEntry,
> extends ComponentPropsWithoutRef<'div'> {
  editor: EnvironmentVariablesEditorController<TRow>;
  disabled?: boolean;
  readOnly?: boolean;
  rowErrors?: EnvironmentVariablesEditorRowErrors;
  hidePasteHint?: boolean;
}

export type EnvironmentVariablesEditorPasteHintProps = ComponentPropsWithoutRef<'p'>;

export interface EnvironmentVariablesEditorProps<
  TRow extends EnvironmentVariableEntry = EnvironmentVariableEntry,
> extends EnvironmentVariablesEditorRootProps<TRow> {
  addLabel?: ReactNode;
  keyLabel?: ReactNode;
  valueLabel?: ReactNode;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  duplicateKeyMessage?: ReactNode;
  error?: ReactNode;
  actions?: ReactNode;
}

export type EnvironmentVariablesEditorUploadProps = ComponentPropsWithoutRef<'div'>;

export interface EnvironmentVariablesEditorUploadButtonProps extends Omit<ButtonProps, 'children'> {
  children?: ReactNode;
  inputLabel?: string;
}

export interface EnvironmentVariablesEditorRowLabels {
  keyLabel?: ReactNode;
  valueLabel?: ReactNode;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  duplicateKeyMessage?: ReactNode;
}

export interface EnvironmentVariablesEditorRowsProps
  extends ComponentPropsWithoutRef<'div'>, EnvironmentVariablesEditorRowLabels {
  rowErrors?: EnvironmentVariablesEditorRowErrors;
}

export interface EnvironmentVariablesEditorRowProps
  extends Omit<ComponentPropsWithoutRef<'div'>, 'children'>, EnvironmentVariablesEditorRowLabels {
  row: EnvironmentVariableEntry;
  index: number;
  rowErrors?: EnvironmentVariablesEditorRowErrors;
}

export type EnvironmentVariablesEditorAddButtonProps = ComponentPropsWithoutRef<'div'>;

interface EnvironmentVariablesEditorNoticeProps extends Omit<NoticeRootProps, 'children' | 'variant'> {
  children?: ReactNode;
  variant?: NoticeRootProps['variant'];
}

export interface EnvironmentVariablesEditorMessagesProps extends EnvironmentVariablesEditorNoticeProps {
  error?: ReactNode;
}

export interface EnvironmentVariablesEditorDuplicateKeysErrorProps extends EnvironmentVariablesEditorNoticeProps {
  message?: ReactNode;
}

export type EnvironmentVariablesEditorUploadErrorProps = EnvironmentVariablesEditorNoticeProps;

export type EnvironmentVariablesEditorActionsProps = ComponentPropsWithoutRef<'div'>;

export type EnvironmentVariablesEditorReadOnlyListProps = Omit<DataListRootProps, 'columns'> & {
  columns?: string;
  header?: ReactNode;
  showHeader?: boolean;
  showIcon?: boolean;
  nameLabel?: ReactNode;
  valueLabel?: ReactNode;
  updatedAtLabel?: ReactNode;
};

export interface EnvironmentVariablesEditorReadOnlyHeaderProps extends Omit<DataListTopProps, 'children'> {
  nameLabel?: ReactNode;
  valueLabel?: ReactNode;
  updatedAtLabel?: ReactNode;
}

export type EnvironmentVariablesEditorReadOnlyEmptyProps = DataListNoMatchProps;

export interface EnvironmentVariablesEditorReadOnlyItemProps extends Omit<DataListRowStaticProps, 'children'> {
  name: ReactNode;
  value?: ReactNode;
  copyValue?: string;
  copyLabel?: string;
  updatedAt?: ReactNode;
  revealed?: boolean;
  defaultRevealed?: boolean;
  onRevealedChange?: (revealed: boolean) => void;
  actor?: ReactNode;
  icon?: ReactNode;
}
