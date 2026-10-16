import { createEventsServer, recordStdinMethods } from './fixture';

recordStdinMethods();
await createEventsServer().server.startStdio();
