export function getCapabilityFileName(provider: string): string {
  return `${encodeURIComponent(provider)}.json`;
}
