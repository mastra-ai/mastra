import type { connectEventTypes } from '../src/event-payloads/event-types.generated.js';
import type { ConnectEventPayloads } from '../src/index.js';

// The runtime lists name exactly the typed providers and their event types.
// A failure here means a payload map changed: run `pnpm generate:event-types`.
type Listed = { -readonly [P in keyof typeof connectEventTypes]: (typeof connectEventTypes)[P][number] };
type Typed = { [P in keyof ConnectEventPayloads]: Extract<keyof ConnectEventPayloads[P], string> };
type Unlisted = { [P in keyof Typed]: Exclude<Typed[P], P extends keyof Listed ? Listed[P] : never> }[keyof Typed];

export const everyTypedEventIsListed: [Unlisted] extends [never] ? true : Unlisted = true;
export const everyProviderIsListed: [Exclude<keyof Typed, keyof Listed>] extends [never] ? true : false = true;
