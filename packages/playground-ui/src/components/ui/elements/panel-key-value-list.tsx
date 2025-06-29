import { Fragment } from 'react';

type PanelKeyValueListProps = {
  items?: { key: string; value: string }[];
  className?: string;
  style?: React.CSSProperties;
};

export function PanelKeyValueList({ items }: PanelKeyValueListProps) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-2 text-[12px]">
      {items && items.length > 0
        ? items?.map(item => (
            <Fragment key="{item.key}">
              <dt className="text-icon3 min-w-[7rem]">{item.key}:</dt>
              <dd>{item.value}</dd>
            </Fragment>
          ))
        : 'Not defined'}
    </dl>
  );
}
