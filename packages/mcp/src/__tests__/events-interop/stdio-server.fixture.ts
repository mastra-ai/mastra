import { createEventsServer, recordStdinMethods } from './fixture';

recordStdinMethods();
// `EVENTS_INTEROP_WEBHOOK` enables webhook delivery, to probe how it behaves without HTTP authentication.
const webhook = process.env.EVENTS_INTEROP_WEBHOOK ? { url: { allowPrivate: true, allowInsecure: true } } : undefined;
await createEventsServer({ webhook }).server.startStdio();
