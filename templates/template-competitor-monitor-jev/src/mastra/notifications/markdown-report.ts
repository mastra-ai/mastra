import { createHash, randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ChangeNotification, NotificationProvider } from './types';

function quote(value: string) {
  const longestRun = (value.match(/`+/g) ?? []).reduce((longest, run) => Math.max(longest, run.length), 0);
  const fence = '`'.repeat(Math.max(3, longestRun + 1));
  return [`${fence}text`, ...value.split(/\r\n|\r|\n/), fence].join('\n');
}

export function formatMarkdownReport(event: ChangeNotification) {
  const lines = [
    `# Changes for ${event.monitorName}`,
    '',
    `- Date: ${event.date}`,
    `- Monitor: ${event.monitorId}`,
    `- Run: ${event.runId}`,
    `- Event: ${event.eventId}`,
    '',
  ];
  for (const change of event.changes) {
    lines.push(`## ${change.sourceId}`, '', `- Status: ${change.status}`);
    if (change.route) lines.push(`- Route: ${change.route}`);
    if (change.reason) lines.push(`- Reason: ${change.reason}`);
    if (change.evidence) {
      lines.push(
        `- Source: ${change.evidence.sourceUrl}`,
        '',
        'Before:',
        quote(change.evidence.beforeExcerpt || '(empty)'),
        '',
        'After:',
        quote(change.evidence.afterExcerpt || '(empty)'),
      );
    } else {
      lines.push('Evidence is unavailable in this run.');
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

/** Example provider: one idempotent Markdown report per immutable decision event. */
export class MarkdownReportProvider implements NotificationProvider {
  readonly id = 'markdown-report';

  constructor(private readonly directory: string) {}

  async notify(event: ChangeNotification, options?: { abortSignal?: AbortSignal }) {
    const signal = options?.abortSignal;
    signal?.throwIfAborted();
    await mkdir(this.directory, { recursive: true });
    const key = createHash('sha256').update(event.eventId).digest('hex');
    const path = join(this.directory, `${key}.md`);
    const temporary = join(this.directory, `.${key}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, formatMarkdownReport(event), { flag: 'wx', signal });
      signal?.throwIfAborted();
      await rename(temporary, path);
    } finally {
      await rm(temporary, { force: true });
    }
  }
}
