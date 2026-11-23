/** Loads an optional peer that is intentionally not installed anywhere in the fixture. */
export async function loadOptionalPeer(): Promise<'installed' | 'missing'> {
  try {
    // @ts-expect-error -- optional peer, not installed
    await import('@inner/missing-optional-peer');
    return 'installed';
  } catch {
    return 'missing';
  }
}
