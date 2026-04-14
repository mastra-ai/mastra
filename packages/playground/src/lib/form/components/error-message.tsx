import { Alert, AlertTitle } from '@mastra/playground-ui';
import React from 'react';

export const ErrorMessage: React.FC<{ error: string }> = ({ error }) => (
  <Alert variant="destructive">
    <AlertTitle>{error}</AlertTitle>
  </Alert>
);
