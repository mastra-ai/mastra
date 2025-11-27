/**
 * Shared helper functions for vector tests
 */

export const DEFAULT_VECTOR_DIMENSION = 1536;

/**
 * Creates a test vector with distinguishable characteristics.
 * Uses a seed to generate different patterns for different test vectors.
 *
 * @param seed - Seed value for generating distinguishable vector values
 * @param dimension - Vector dimension (defaults to 1536)
 */
export function createVector(seed: number, dimension: number = DEFAULT_VECTOR_DIMENSION): number[] {
  const vector = new Array(dimension).fill(0);
  // Set a few dimensions based on the seed for distinguishability
  for (let i = 0; i < Math.min(10, dimension); i++) {
    vector[i] = (seed + i * 0.1) / 10;
  }
  // Normalize for cosine similarity
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
}

/**
 * Creates a unit vector with a single active dimension.
 * Useful for tests that need orthogonal vectors.
 *
 * @param activeIndex - The index of the dimension to set to 1
 * @param dimension - Vector dimension (defaults to 1536)
 */
export function createUnitVector(activeIndex: number, dimension: number = DEFAULT_VECTOR_DIMENSION): number[] {
  const vector = new Array(dimension).fill(0);
  vector[activeIndex % dimension] = 1;
  return vector;
}
