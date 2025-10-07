/**
 * Try to execute the primary function. If it fails, execute the fallback function.
 * @param primary - The primary function to attempt first
 * @param fallback - The fallback function to execute if primary fails
 * @returns The result from either primary or fallback
 */
export async function tryWithFallback<T>(primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  try {
    return await primary();
  } catch (error) {
    console.warn('Error in tryWithFallback. Attempting fallback.', error);
    return await fallback();
  }
}
