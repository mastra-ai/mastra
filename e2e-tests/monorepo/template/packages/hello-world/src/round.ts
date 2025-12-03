import { roundTo } from 'round-to';
import { colorful } from './shared/colorful';

export function roundToOneNumber(num: number): number {
  console.debug(colorful('Rounding number:'), num);

  return roundTo(num, 0);
}
