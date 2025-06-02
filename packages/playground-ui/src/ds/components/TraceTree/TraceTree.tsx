import React from 'react';

export interface TraceTreeProps {
  children: React.ReactNode;
}

export const TraceTree = ({ children }: TraceTreeProps) => {
  return <ol>{children}</ol>;
};
