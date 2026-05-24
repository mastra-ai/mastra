/**
 * Tests for `HarnessStorage.capabilities()`.
 *
 * The base default uses the same prototype-detection idiom as
 * `supportsAtomicDeleteSessions` (base.ts:392): a feature family counts as
 * supported only when every method in the family is overridden. Adapters
 * with config-driven toggles override `capabilities()` directly.
 */

import { describe, expect, it } from 'vitest';

import { InMemoryDB } from '../inmemory-db';
import { HarnessStorage } from './base';
import { InMemoryHarness } from './inmemory';

describe('HarnessStorage.capabilities()', () => {
  it('InMemoryHarness reports every feature as supported via prototype detection', () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    expect(storage.capabilities()).toEqual({
      workspaceActionJournal: true,
      sessionEventReplay: true,
      harnessArtifacts: true,
      admissionConflictDetection: true,
      attachmentBlobs: true,
      channelOutbox: true,
      wakeups: true,
      proactiveWakeups: true,
    });
  });

  it('an adapter that reassigns optional methods back to the base prototype reports the matching feature as unsupported', () => {
    class LegacyAdapter extends InMemoryHarness {
      // Pretend this adapter never shipped the session-event-replay feature
      // family. Reassign each method back to the base prototype so the
      // prototype-detection check at `HarnessStorage.capabilities()` flips
      // `sessionEventReplay` to false. Mirrors the way `supportsAtomicDeleteSessions`
      // is detected at base.ts:392.
      override appendSessionEvent = HarnessStorage.prototype.appendSessionEvent;
      override getSessionEventReplayState = HarnessStorage.prototype.getSessionEventReplayState;
      override listSessionEvents = HarnessStorage.prototype.listSessionEvents;
    }
    const storage = new LegacyAdapter({ db: new InMemoryDB() });
    const caps = storage.capabilities();
    expect(caps.sessionEventReplay).toBe(false);
    // The journal feature family is untouched and stays supported.
    expect(caps.workspaceActionJournal).toBe(true);
  });

  it('a partial adapter that only overrides the write side of a feature family is treated as unsupported', () => {
    // Review surfaced this: a half-implemented family (write but not
    // read, or vice versa) must NOT report the feature as supported, or the
    // runtime would write rows it can never read back.
    class PartialJournalAdapter extends InMemoryHarness {
      override listWorkspaceActionJournalEntries = HarnessStorage.prototype.listWorkspaceActionJournalEntries;
    }
    const storage = new PartialJournalAdapter({ db: new InMemoryDB() });
    expect(storage.capabilities().workspaceActionJournal).toBe(false);
  });

  it('an adapter override of capabilities() takes precedence over the prototype-detection default', () => {
    // Adapters with config-driven toggles (e.g. a feature gated by an
    // environment variable) replace the default by overriding the method.
    class TogglingAdapter extends InMemoryHarness {
      override capabilities() {
        return {
          workspaceActionJournal: false,
          sessionEventReplay: false,
          admissionConflictDetection: true,
          attachmentBlobs: true,
          channelOutbox: false,
          wakeups: true,
          proactiveWakeups: false,
        };
      }
    }
    const storage = new TogglingAdapter({ db: new InMemoryDB() });
    expect(storage.capabilities()).toMatchObject({
      workspaceActionJournal: false,
      sessionEventReplay: false,
      channelOutbox: false,
      proactiveWakeups: false,
    });
  });
});
