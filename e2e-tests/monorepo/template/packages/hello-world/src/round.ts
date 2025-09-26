import { roundTo } from 'round-to';

export function roundToOneNumber(num: number): number {
  return roundTo(num, 0);
}
