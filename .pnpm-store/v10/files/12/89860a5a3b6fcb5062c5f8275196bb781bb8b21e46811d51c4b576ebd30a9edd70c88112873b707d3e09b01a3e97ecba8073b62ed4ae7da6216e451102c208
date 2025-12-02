import type { NodePath } from '@babel/traverse';
type Predicate<T extends NodePath> = (path: NodePath) => path is T;
/**
 * This can be used in two ways
 * 1. Find the first return path that passes the predicate function
 *    (for example to check if a function is returning something)
 * 2. Find all occurrences of return values
 *    For this the predicate acts more like a collector and always needs to return false
 */
export default function findFunctionReturn<T extends NodePath = NodePath>(path: NodePath, predicate: Predicate<T>): T | undefined;
export {};
