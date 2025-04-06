export function isCloserTo(value: number, target1: number, target2: number): boolean {
  return Math.abs(value - target1) < Math.abs(value - target2);
}
