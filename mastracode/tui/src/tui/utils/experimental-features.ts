export function isSubconsciousEnabled(): boolean {
  return process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS === '1';
}
