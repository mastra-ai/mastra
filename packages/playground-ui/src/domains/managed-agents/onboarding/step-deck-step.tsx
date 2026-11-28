import type { ReactNode } from 'react';

export interface StepDeckStepProps {
  title: string;
  children: ReactNode;
}

export function StepDeckStep({ children }: StepDeckStepProps) {
  return children;
}
