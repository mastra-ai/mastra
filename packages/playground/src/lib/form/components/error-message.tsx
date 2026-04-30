import { Notice } from '@mastra/playground-ui';
import React from 'react';

export const ErrorMessage: React.FC<{ error: string }> = ({ error }) => <Notice variant="destructive" title={error} />;
