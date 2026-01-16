import React from 'react';

import { Alert, AlertTitle } from '@/ds/components/Alert';

export const ErrorMessage: React.FC<{ error: string }> = ({ error }) => (
  <Alert variant="destructive">
    <AlertTitle>{error}</AlertTitle>
  </Alert>
);
