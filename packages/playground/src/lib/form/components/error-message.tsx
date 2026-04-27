import { Notice } from '@mastra/playground-ui';
import { OctagonAlertIcon } from 'lucide-react';
import React from 'react';

export const ErrorMessage: React.FC<{ error: string }> = ({ error }) => (
  <Notice variant="destructive">
    <OctagonAlertIcon />
    <Notice.Title>{error}</Notice.Title>
  </Notice>
);
