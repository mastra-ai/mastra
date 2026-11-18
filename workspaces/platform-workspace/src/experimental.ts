/**
 * The computer desktop (`PlatformSandbox`'s `computer: true`, the Factory
 * `desktop` setting) is experimental: without `MASTRA_EXPERIMENTAL_COMPUTER=true`
 * both are ignored and nothing differs from a build without them.
 */
export function experimentalComputerEnabled(): boolean {
  return process.env.MASTRA_EXPERIMENTAL_COMPUTER === 'true';
}
