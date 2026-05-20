import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { UnixSocketPubSub } from '@mastra/core/events';

import { getAppDataDir } from './project.js';

function getSignalsDir(): string {
  const dir = path.join(getAppDataDir(), 'signals');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

export function getSignalsPubSubSocketPath(resourceId: string): string {
  return path.join(getSignalsDir(), `${shortHash(resourceId)}.sock`);
}

export function createSignalsPubSub(resourceId: string): UnixSocketPubSub {
  return new UnixSocketPubSub(getSignalsPubSubSocketPath(resourceId));
}
