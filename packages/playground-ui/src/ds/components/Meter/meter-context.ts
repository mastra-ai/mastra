import { createContext } from 'react';
import { formatFullNumber } from '../../../lib/cost';

export type MeterPart = 'bar' | 'key';

export const MeterPartContext = createContext<{ part: MeterPart; format: (value: number) => string }>({
  part: 'bar',
  format: formatFullNumber,
});

export const sourceColorClassName = [
  '[&>:nth-child(5n+1)]:[--meter-source:var(--chart-share-1)]',
  '[&>:nth-child(5n+2)]:[--meter-source:var(--chart-share-2)]',
  '[&>:nth-child(5n+3)]:[--meter-source:var(--chart-share-3)]',
  '[&>:nth-child(5n+4)]:[--meter-source:var(--chart-share-4)]',
  '[&>:nth-child(5n)]:[--meter-source:var(--chart-share-5)]',
].join(' ');
