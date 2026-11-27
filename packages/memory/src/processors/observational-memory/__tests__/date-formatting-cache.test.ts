import type { MastraDBMessage } from '@mastra/core/agent';
import { afterEach, describe, expect, it } from 'vitest';

import { formatRelativeTime, formatTemporalTimestamp } from '../date-utils';
import { formatMessagesForObserver } from '../observer-agent';

// Zones with DST, half-hour and 45-minute offsets, and a name the runtime does not know (falls back to the process zone).
const ZONES = [
  undefined,
  'UTC',
  'America/Los_Angeles',
  'Europe/London',
  'Asia/Kolkata',
  'Asia/Kathmandu',
  'America/St_Johns',
  'Australia/Lord_Howe',
  'Pacific/Chatham',
  'Not/A_Zone',
];

const INSTANTS = [
  Date.UTC(2026, 2, 8, 9, 59), // just before US DST starts
  Date.UTC(2026, 2, 8, 10, 1), // just after
  Date.UTC(2026, 2, 29, 0, 59), // just before UK DST starts
  Date.UTC(2026, 2, 29, 1, 0),
  Date.UTC(2026, 3, 4, 14, 59), // Lord Howe's half-hour DST change
  Date.UTC(2026, 3, 4, 15, 0),
  Date.UTC(2026, 10, 1, 8, 59), // US DST ends
  Date.UTC(2026, 10, 1, 9, 0),
  Date.UTC(2024, 1, 29, 23, 59, 59), // leap day, last second
  Date.UTC(2026, 11, 31, 23, 59, 30),
  Date.UTC(1850, 5, 1, 12, 0, 17), // local mean time, offsets with seconds
  Date.UTC(1850, 5, 1, 12, 1, 3),
  Date.UTC(2100, 0, 1, 0, 0),
  Date.UTC(1970, 0, 1, 0, 0),
];

/** The observer header and line text, built with a new formatter for every value as the code did before. */
function referenceObserverText(instants: number[], timeZone: string | undefined): string {
  let zone = timeZone;
  try {
    if (zone) new Intl.DateTimeFormat('en-US', { timeZone: zone });
  } catch {
    zone = undefined;
  }
  const lines: string[] = [];
  let lastDate: string | undefined;
  let lastTime: string | undefined;
  instants.forEach((instant, index) => {
    const date = new Date(instant);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value;
    const day = `${part('month')} ${part('day')} ${part('year')}`;
    if (day !== lastDate) {
      lines.push(`${day}:`);
      lastTime = undefined;
    }
    lastDate = day;
    const time = date.toLocaleTimeString('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit', hour12: true });
    // A line repeats its time only when it differs from the line before it on the same date.
    lines.push(time === lastTime ? `User: message ${index}` : `User (${time}): message ${index}`);
    lastTime = time;
  });
  return lines.join('\n');
}

function messages(instants: number[]): MastraDBMessage[] {
  return instants.map((instant, index) => ({
    id: `m${index}`,
    threadId: 't',
    resourceId: 'r',
    role: 'user',
    createdAt: new Date(instant),
    content: { format: 2, parts: [{ type: 'text', text: `message ${index}` }] },
  }));
}

/** The observer text for one message per instant: each instant on its own, so every line has its date header. */
function observerTextEach(instants: number[], timeZone: string | undefined): string[] {
  return instants.map(instant => formatMessagesForObserver(messages([instant]), { timeZone }).trim());
}

function withProcessZone<T>(zone: string, run: () => T): T {
  const previous = process.env.TZ;
  process.env.TZ = zone;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

/** Counts `Intl.DateTimeFormat` constructions while `run` runs. */
function countFormatterConstructions(run: () => void): number {
  const Original = Intl.DateTimeFormat;
  let count = 0;
  Intl.DateTimeFormat = new Proxy(Original, {
    construct(target, args) {
      count++;
      return Reflect.construct(target, args);
    },
    apply(target, thisArg, args) {
      count++;
      return Reflect.apply(target, thisArg, args);
    },
  });
  try {
    run();
  } finally {
    Intl.DateTimeFormat = Original;
  }
  return count;
}

describe('Observational Memory date formatting', () => {
  afterEach(() => {
    expect(Intl.DateTimeFormat.name).toBe('DateTimeFormat');
  });

  it.each(ZONES.map(zone => [zone ?? 'process zone', zone] as const))(
    'formats observer dates and times exactly as before in %s',
    (_name, zone) => {
      expect(observerTextEach(INSTANTS, zone)).toEqual(INSTANTS.map(instant => referenceObserverText([instant], zone)));
      // Repeated calls reuse formatters and must give the same text.
      expect(observerTextEach(INSTANTS, zone)).toEqual(INSTANTS.map(instant => referenceObserverText([instant], zone)));
    },
  );

  it('formats a whole run of messages with date headers exactly as before', () => {
    const sorted = [...INSTANTS].sort((a, b) => a - b);
    for (const zone of ZONES) {
      expect(formatMessagesForObserver(messages(sorted), { timeZone: zone }).trim()).toBe(
        referenceObserverText(sorted, zone),
      );
    }
  });

  it('follows a change of the process time zone when no zone is given', () => {
    for (const processZone of ['Asia/Tokyo', 'America/New_York', 'Asia/Tokyo', 'Pacific/Chatham']) {
      withProcessZone(processZone, () => {
        expect(observerTextEach(INSTANTS, undefined)).toEqual(
          INSTANTS.map(instant => referenceObserverText([instant], undefined)),
        );
        for (const instant of INSTANTS) {
          const date = new Date(instant);
          expect(formatTemporalTimestamp(date)).toBe(
            date.toLocaleString('en-US', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
              timeZoneName: 'short',
            }),
          );
        }
      });
    }
  });

  it('formats an invalid temporal timestamp as before', () => {
    expect(formatTemporalTimestamp(new Date(Number.NaN))).toBe(new Date(Number.NaN).toLocaleString('en-US'));
  });

  it('counts relative days on the same calendar as before in every zone', () => {
    const now = new Date(Date.UTC(2026, 10, 22, 7, 30));
    const dayNumber = (instant: Date, zone: string | undefined) => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      }).formatToParts(instant);
      const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(p => p.type === type)?.value);
      return Date.UTC(part('year'), part('month') - 1, part('day')) / 86_400_000;
    };
    let checked = 0;
    for (const zone of ZONES.filter(zone => zone && zone !== 'Not/A_Zone')) {
      // Instants from 6 days ago to now, 5 hours apart, so they cross midnight in every zone.
      for (let hours = 0; hours < 6 * 24; hours += 5) {
        const date = new Date(now.getTime() - hours * 3_600_000);
        const days = dayNumber(now, zone) - dayNumber(date, zone);
        const expected = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
        expect(formatRelativeTime(date, now, zone), `${zone} ${date.toISOString()}`).toBe(expected);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('builds date formatters once, not once per formatted message', () => {
    const many = messages(Array.from({ length: 500 }, (_, i) => Date.UTC(2026, 0, 1) + i * 3_600_000));
    formatMessagesForObserver(many.slice(0, 1), { timeZone: 'Asia/Kathmandu' });
    const constructions = countFormatterConstructions(() => {
      formatMessagesForObserver(many, { timeZone: 'Asia/Kathmandu' });
      formatMessagesForObserver(many, { timeZone: 'Asia/Kathmandu' });
      for (const message of many) {
        formatTemporalTimestamp(message.createdAt);
        formatRelativeTime(message.createdAt, new Date(Date.UTC(2026, 1, 1)), 'Asia/Kathmandu');
      }
    });
    expect(constructions).toBeLessThanOrEqual(4);
  });
});
