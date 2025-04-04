import React from 'react';
import { ObjectWrapperProps } from '@autoform/react';

export const ObjectWrapper: React.FC<ObjectWrapperProps> = ({ label, children }) => {
  return (
    <div className="space-y-4 border p-2 rounded-md">
      {label === '\u200B' ? <></> : <h3 className="text-sm font-medium">{label}</h3>}
      {children}
    </div>
  );
};
