import { createPlainServer, recordStdinMethods } from './fixture';

recordStdinMethods();
await createPlainServer().startStdio();
