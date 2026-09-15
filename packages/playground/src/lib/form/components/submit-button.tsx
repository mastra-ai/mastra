import { Button } from '@mastra/playground-ui/components/Button';
import React from 'react';

export const SubmitButton: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Button type="submit">{children}</Button>
);
