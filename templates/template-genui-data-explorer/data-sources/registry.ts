import type { DataSource, SourceRegistration, SourceSettings } from "./source.ts";

export function selectSource<Registration extends SourceRegistration>(
  registrations: readonly Registration[],
  id: string,
): Registration {
  const seen = new Set<string>();
  for (const registration of registrations) {
    if (!registration.id || seen.has(registration.id))
      throw new Error("Source IDs must be nonempty and unique.");
    seen.add(registration.id);
  }
  const selected = registrations.find((registration) => registration.id === id);
  if (!selected || selected.enabled === false)
    throw new Error(
      `Source '${id}' is unavailable. Select an enabled registered source; no fallback is applied.`,
    );
  return selected;
}

export async function openDataSource(
  registrations: readonly SourceRegistration[],
  id: string,
  settings: SourceSettings = {},
): Promise<DataSource> {
  const source = await selectSource(registrations, id).open(settings);
  try {
    if (source.describe().id !== id)
      throw new Error("The opened source does not match its registered ID.");
    return source;
  } catch (error) {
    await source.close();
    throw error;
  }
}
