import { roundTo } from 'round-to';
import { IgetYouAnything } from '@inner/lodash';

export function roundToOneNumber(arg: { x: number }): number {
  return roundTo(IgetYouAnything(arg, 'x'), 0);
}
