import { EVENTS_EXTENSION_ID } from './constants';
import { EventsCapabilitySchema } from './schemas';
import type { EventsCapability } from './types';

/**
 * Read the negotiated events extension settings from a capabilities object.
 * Returns `undefined` when the peer did not advertise the extension (or advertised a malformed entry).
 *
 * Only the SEP-3415 `extensions["io.modelcontextprotocol/events"]` form is recognized; the legacy
 * top-level `capabilities.events` key from pre-SEP prototypes is intentionally ignored.
 *
 * @experimental
 */
export function getEventsCapability(
  capabilities: { extensions?: Record<string, unknown> } | undefined | null,
): EventsCapability | undefined {
  const entry = capabilities?.extensions?.[EVENTS_EXTENSION_ID];
  if (entry === undefined) return undefined;
  const parsed = EventsCapabilitySchema.safeParse(entry);
  return parsed.success ? parsed.data : undefined;
}

/**
 * Build the `extensions` entry a server advertises when it offers events. The value is plain JSON, so it
 * can be spread into the SDK's `ServerCapabilities['extensions']`.
 *
 * @experimental
 */
export function eventsCapabilityEntry(
  settings: { listChanged?: boolean } = {},
): Record<string, { listChanged: boolean } | Record<string, never>> {
  return { [EVENTS_EXTENSION_ID]: settings.listChanged === undefined ? {} : { listChanged: settings.listChanged } };
}
