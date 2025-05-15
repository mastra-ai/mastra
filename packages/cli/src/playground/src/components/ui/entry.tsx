import { Txt } from '@mastra/playground-ui';
import { ReactNode } from 'react';

export interface EntryProps {
  label: ReactNode;
  children: ReactNode;
}

export const Entry = ({ label, children }: EntryProps) => {
  return (
    <div className="space-y-2">
      <Txt as="p" variant="ui-md" className="text-icon3">
        {label}
      </Txt>

      {children}
    </div>
  );
};
