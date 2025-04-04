import React from 'react';
import { AlertCircle } from 'lucide-react';

import { Alert, AlertTitle } from '@/components/ui/alert';

export const ErrorMessage: React.FC<{ error: string }> = ({ error }) => (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>{error}</AlertTitle>
  </Alert>
);
