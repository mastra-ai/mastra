import clsx from 'clsx';
import { Separator } from 'react-resizable-panels';

export const PanelSeparator = () => {
  return (
    <Separator
      className={clsx(
        'w-1.5 bg-surface3',
        "[&[data-separator='hover']]:!bg-surface4",
        "[&[data-separator='active']]:!bg-surface5",
        'focus:outline-none',
      )}
    />
  );
};
