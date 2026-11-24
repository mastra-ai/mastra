import React from 'react';
import { Notice } from '@/ds/components/Notice';

export const ErrorMessage: React.FC<{ error: string }> = ({ error }) => <Notice variant="destructive" title={error} />;
