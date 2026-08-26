import * as fs from 'node:fs';

import { truncateLogFile } from '@mastra/code-sdk/utils/debug-log';

const CRASH_LOG_PATH = '/tmp/mastra-crash.log';

export function appendCrashLog(crashLog: string, logFile = CRASH_LOG_PATH): void {
  truncateLogFile(logFile);
  fs.appendFileSync(logFile, crashLog);
  truncateLogFile(logFile);
}
