import { use } from 'react';
import type { ReactNode } from 'react';
import { MeterPartContext } from './meter-context';
import { MeterKeyRow } from './meter-key-row';
import { MeterSegment } from './meter-segment';

export type MeterSourceProps = {
  label: ReactNode;
  value: number;
};

export function MeterSource({ label, value }: MeterSourceProps) {
  const { part, format } = use(MeterPartContext);
  if (part === 'key') return <MeterKeyRow swatch="bg-(--meter-source)" label={label} amount={format(value)} />;
  return <MeterSegment slot="meter-source" grow={Math.max(0, value)} className="bg-(--meter-source)" />;
}
