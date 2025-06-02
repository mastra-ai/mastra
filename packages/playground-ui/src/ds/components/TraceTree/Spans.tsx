import React from 'react';

export interface SpansProps {
  children: React.ReactNode;
}

export const Spans = ({ children }: SpansProps) => {
  return <ol>{children}</ol>;
};
