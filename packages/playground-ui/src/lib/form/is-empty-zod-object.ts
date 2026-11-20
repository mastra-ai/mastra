import { getIntersection, getShape } from './zod-provider/compat';

export function isEmptyZodObject(schema: unknown): boolean {
  const shape = getShape(schema);
  if (shape) {
    return Object.keys(shape).length === 0;
  }

  const intersection = getIntersection(schema);
  if (intersection) {
    return isEmptyZodObject(intersection.left) && isEmptyZodObject(intersection.right);
  }

  return false;
}
