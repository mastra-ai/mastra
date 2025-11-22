/**
 * Shared helper functions for vector tests
 */

export const VECTOR_DIMENSION = 1536;

/**
 * Creates a 1536-dimensional test vector with distinguishable characteristics.
 * Uses a seed to generate different patterns for different test vectors.
 */
export function createVector(seed: number): number[] {
  const vector = new Array(VECTOR_DIMENSION).fill(0);
  // Set a few dimensions based on the seed for distinguishability
  for (let i = 0; i < Math.min(10, VECTOR_DIMENSION); i++) {
    vector[i] = (seed + i * 0.1) / 10;
  }
  // Normalize for cosine similarity
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
}

/**
 * Creates a 1536-dimensional unit vector with a single active dimension.
 * Useful for tests that need orthogonal vectors.
 */
export function createUnitVector(activeIndex: number): number[] {
  const vector = new Array(VECTOR_DIMENSION).fill(0);
  vector[activeIndex] = 1;
  return vector;
}
