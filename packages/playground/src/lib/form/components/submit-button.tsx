import { Button } from '@mastra/playground-ui';
import React from 'react';

export const SubmitButton: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Button type="submit">{children}</Button>
);
