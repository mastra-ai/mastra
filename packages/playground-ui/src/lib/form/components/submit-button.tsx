import React from 'react';
import { Button } from '@/ds/components/Button';

export const SubmitButton: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Button type="submit">{children}</Button>
);
