/**
 * One param:  create list of integers from 0 (inclusive) to n (exclusive)
 * Two params: create list of integers from a (inclusive) to b (exclusive)
 */
export function range(n: number, b?: number): number[] {
	return b
		? Array(b - n)
				.fill(0)
				.map((_, i) => n + i)
		: Array(n)
				.fill(0)
				.map((_, i) => i);
}
