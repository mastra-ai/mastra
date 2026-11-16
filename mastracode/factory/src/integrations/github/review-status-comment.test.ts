import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  parseReviewStatusState,
  renderReviewStatusComment,
  REVIEW_STATUS_COMMENT_MARKER,
  supersedesReviewStatus,
} from './review-status-comment.js';
import type { ReviewStatusState, ReviewStatusView } from './review-status-comment.js';

const HEAD = 'a'.repeat(40);
const GIF = 'https://example.test/reviewing.gif';
const DARK_GIF = 'https://example.test/reviewing-dark.gif';

function state(overrides: Partial<ReviewStatusState> = {}): ReviewStatusState {
  return {
    run: 'decision-1',
    requestedAt: '2026-11-05T10:00:00.000Z',
    generation: 0,
    attempt: 1,
    phase: 'queued',
    ...overrides,
  };
}

function view(overrides: Partial<ReviewStatusView> = {}): ReviewStatusView {
  return { state: state(), reviewerName: 'Shipyard', gifUrl: GIF, ...overrides };
}

describe('renderReviewStatusComment', () => {
  it('round-trips the hidden state', () => {
    const recorded = state({ phase: 'reviewing', startedAt: '2026-11-05T10:01:00.000Z', head: HEAD });
    const body = renderReviewStatusComment(view({ state: recorded }));
    expect(body.startsWith(REVIEW_STATUS_COMMENT_MARKER)).toBe(true);
    expect(parseReviewStatusState(body)).toEqual(recorded);
  });

  it('does not show the animation or claim work is running while queued', () => {
    const body = renderReviewStatusComment(view());
    expect(body).toContain('Review queued');
    expect(body).toContain('has not started yet');
    expect(body).not.toContain(GIF);
    expect(body).not.toContain('Reviewing…');
  });

  it('shows the animation with alt text and a text fallback while reviewing', () => {
    const body = renderReviewStatusComment(
      view({ state: state({ phase: 'reviewing', startedAt: '2026-11-05T10:01:00.123Z', head: HEAD }) }),
    );
    expect(body).toContain(
      `<img src="${GIF}" alt="Animated ASCII factory with smoke puffing from its chimneys: Shipyard is reviewing this pull request" width="360">`,
    );
    expect(body).not.toContain('<picture>');
    // Shown smaller than the 468px asset; one width and no height keeps the aspect ratio.
    expect(body.match(/<img [^>]*>/g)).toHaveLength(1);
    expect(body).not.toMatch(/height=/);
    expect(body).toContain('Shipyard is reviewing this pull request on `aaaaaaa` since 2026-11-05T10:01:00Z.');
  });

  it("matches the animation to the reader's GitHub theme", () => {
    const body = renderReviewStatusComment(view({ state: state({ phase: 'reviewing' }), gifDarkUrl: DARK_GIF }));
    const picture = [
      '>',
      '> <picture>',
      `>   <source media="(prefers-color-scheme: dark)" srcset="${DARK_GIF}">`,
      `>   <source media="(prefers-color-scheme: light)" srcset="${GIF}">`,
      `>   <img src="${GIF}" alt="Animated ASCII factory with smoke puffing from its chimneys: Shipyard is reviewing this pull request" width="360">`,
      '> </picture>',
      '>',
    ].join('\n');
    // Blank quoted lines around the block keep GitHub from reading the markup as text inside the alert.
    expect(body).toContain(picture);
    // The width sits on the fallback img, which sizes whichever source the theme picks.
    expect(body.match(/width="360"/g)).toHaveLength(1);
    expect(body).not.toMatch(/height=/);
    expect(body).toContain('Shipyard is reviewing this pull request.');
    for (const phase of ['queued', 'retrying', 'completed', 'failed', 'cancelled'] as const) {
      const ended = renderReviewStatusComment(view({ state: state({ phase }), gifDarkUrl: DARK_GIF }));
      expect(ended).not.toContain('<picture>');
      expect(ended).not.toContain(DARK_GIF);
    }
  });

  it('colors each status with a GitHub alert and keeps the hidden markers outside it', () => {
    const cases: Array<[Partial<ReviewStatusView>, string]> = [
      [{ state: state({ phase: 'queued' }) }, 'NOTE'],
      [{ state: state({ phase: 'reviewing' }) }, 'NOTE'],
      [{ state: state({ phase: 'retrying' }) }, 'WARNING'],
      [{ state: state({ phase: 'completed' }), stats: { verdict: 'approve' } }, 'TIP'],
      [{ state: state({ phase: 'completed' }), stats: { verdict: 'request changes' } }, 'IMPORTANT'],
      [{ state: state({ phase: 'completed' }) }, 'IMPORTANT'],
      [{ state: state({ phase: 'failed' }), stats: { durationMs: 1_000 } }, 'CAUTION'],
      [{ state: state({ phase: 'cancelled' }) }, 'WARNING'],
    ];
    for (const [overrides, type] of cases) {
      const lines = renderReviewStatusComment(view(overrides)).trimEnd().split('\n');
      expect(lines[0]).toBe(REVIEW_STATUS_COMMENT_MARKER);
      expect(parseReviewStatusState(lines.join('\n'))).toEqual(overrides.state);
      expect(lines[2]).toBe(`> [!${type}]`);
      // Every visible line stays inside the alert, so GitHub draws one box.
      expect(lines.slice(3).every(line => line === '>' || line.startsWith('> '))).toBe(true);
    }
  });

  it('keeps configured names and URLs inside their HTML attributes', () => {
    const body = renderReviewStatusComment(
      view({
        state: state({ phase: 'reviewing' }),
        reviewerName: 'Bot "x" <b>',
        gifUrl: 'https://a.test/l.gif?a=1&b="2"',
        gifDarkUrl: 'https://a.test/d.gif"><script>',
      }),
    );
    expect(body).toContain('srcset="https://a.test/d.gif&quot;&gt;&lt;script&gt;"');
    expect(body).toContain('src="https://a.test/l.gif?a=1&amp;b=&quot;2&quot;"');
    expect(body).toContain(
      'alt="Animated ASCII factory with smoke puffing from its chimneys: Bot &quot;x&quot; &lt;b&gt; is',
    );
    expect(body).not.toContain('<script>');
  });

  it('ends a completed review with its verdict and a quiet footer linking the reviewed commit', () => {
    const reviewed = 'b'.repeat(40);
    const body = renderReviewStatusComment(
      view({
        repository: 'acme/app',
        state: state({ phase: 'completed', head: HEAD }),
        stats: { verdict: 'request changes', reviewedHeadSha: reviewed, durationMs: 125_000 },
      }),
    );
    expect(body).not.toContain(GIF);
    expect(body).toContain('### 🔁 Review complete: changes requested');
    expect(body).toContain(
      `> <sub>Reviewed [\`bbbbbbb\`](https://github.com/acme/app/commit/${reviewed}) · took 2m 5s</sub>`,
    );
    expect(body).not.toContain('Started on');
    expect(body).not.toContain('|');
  });

  it('never calls a commit reviewed without a verdict, and says when none was recorded', () => {
    const body = renderReviewStatusComment(
      view({
        state: state({ phase: 'completed', head: HEAD }),
        stats: { reviewedHeadSha: 'b'.repeat(40), durationMs: 88_000 },
      }),
    );
    expect(body).toContain('### ☑️ Review finished');
    expect(body).toContain('The review run ended without recording a verdict for this pass.');
    expect(body).toContain('> <sub>Started on `aaaaaaa` · took 1m 28s</sub>');
    expect(body).not.toContain('Reviewed');
  });

  it('drops the footer, or the parts of it, that it has no data for', () => {
    const bare = renderReviewStatusComment(view({ state: state({ phase: 'completed' }) }));
    expect(bare).toContain('without recording a verdict');
    expect(bare).not.toContain('<sub>');
    const timed = renderReviewStatusComment(
      view({ state: state({ phase: 'cancelled' }), stats: { durationMs: 41_000 } }),
    );
    expect(timed).toContain('> <sub>Took 41s</sub>');
    const unlinked = renderReviewStatusComment(
      view({ repository: 'not a slug', state: state({ phase: 'cancelled', head: HEAD }) }),
    );
    expect(unlinked).toContain('> <sub>Started on `aaaaaaa`</sub>');
    expect(unlinked).not.toContain('](');
  });

  it('ends failed runs with a sanitized reason and how to retry, without attempt counts', () => {
    const body = renderReviewStatusComment(
      view({
        state: state({ phase: 'failed', attempt: 5, head: HEAD }),
        reason: 'boom\n```\n<script>',
        stats: { reviewedHeadSha: 'b'.repeat(40), durationMs: 61_000 },
      }),
    );
    expect(body).toContain('### ❌ Review failed');
    expect(body).toContain("The review did not finish: `boom ''' <script>`");
    expect(body).toContain('Request a review from Shipyard again to retry.');
    expect(body).toContain('> <sub>Started on `aaaaaaa` · took 1m 1s</sub>');
    expect(body).not.toMatch(/Reviewed|Attempt|\|/);
    expect(body).not.toContain(GIF);
  });

  it('ends cancelled runs without the animation', () => {
    const body = renderReviewStatusComment(view({ state: state({ phase: 'cancelled' }) }));
    expect(body).toContain('### ⏹️ Review cancelled');
    expect(body).toContain('replaced before it finished');
    expect(body).not.toContain(GIF);
  });

  it('does not claim a retry is running or count attempts', () => {
    const body = renderReviewStatusComment(
      view({ state: state({ phase: 'retrying', attempt: 2 }), reason: 'timeout' }),
    );
    expect(body).toContain('Review queued for retry');
    expect(body).toContain('The last attempt did not finish: `timeout`');
    expect(body).toContain('retries automatically');
    expect(body).not.toMatch(/Attempt|<sub>/);
    expect(body).not.toContain(GIF);
    const bare = renderReviewStatusComment(view({ state: state({ phase: 'retrying' }) }));
    expect(bare).toContain('The last attempt did not finish.');
  });
});

describe('parseReviewStatusState', () => {
  it('reads malformed or hostile state as no state', () => {
    expect(parseReviewStatusState(undefined)).toBeUndefined();
    expect(parseReviewStatusState('no marker')).toBeUndefined();
    expect(parseReviewStatusState('<!-- mastra-factory-review-status:state {not json} -->')).toBeUndefined();
    const bad = (value: object) =>
      parseReviewStatusState(`<!-- mastra-factory-review-status:state ${JSON.stringify(value)} -->`);
    expect(bad({ ...state(), run: 'has space' })).toBeUndefined();
    expect(bad({ ...state(), phase: 'done' })).toBeUndefined();
    expect(bad({ ...state(), generation: -1 })).toBeUndefined();
    expect(bad({ ...state(), requestedAt: 'yesterday' })).toBeUndefined();
    expect(bad({ ...state(), head: 'not-a-sha' })).toEqual(state());
  });
});

describe('supersedesReviewStatus', () => {
  it('lets the first write through', () => {
    expect(supersedesReviewStatus(undefined, state())).toBe(true);
  });

  it('moves forward through the phases of one run and never back', () => {
    expect(supersedesReviewStatus(state(), state({ phase: 'reviewing' }))).toBe(true);
    expect(supersedesReviewStatus(state({ phase: 'reviewing' }), state({ phase: 'completed' }))).toBe(true);
    expect(supersedesReviewStatus(state({ phase: 'reviewing' }), state({ phase: 'queued' }))).toBe(false);
    expect(supersedesReviewStatus(state({ phase: 'reviewing' }), state({ phase: 'reviewing' }))).toBe(false);
    expect(supersedesReviewStatus(state({ phase: 'completed' }), state({ phase: 'failed' }))).toBe(false);
  });

  it('lets the next attempt or a manual retry take over the same run', () => {
    expect(supersedesReviewStatus(state({ phase: 'retrying' }), state({ attempt: 2 }))).toBe(true);
    expect(supersedesReviewStatus(state({ phase: 'failed', attempt: 5 }), state({ generation: 1, attempt: 1 }))).toBe(
      true,
    );
    expect(supersedesReviewStatus(state({ generation: 1, attempt: 1 }), state({ phase: 'failed', attempt: 5 }))).toBe(
      false,
    );
  });

  it('lets a newer run take over and drops late writes from an older one', () => {
    const older = state({ phase: 'reviewing' });
    const newer = state({ run: 'decision-2', requestedAt: '2026-11-05T11:00:00.000Z' });
    expect(supersedesReviewStatus(older, newer)).toBe(true);
    expect(supersedesReviewStatus(newer, { ...older, phase: 'completed' })).toBe(false);
  });
});

describe('formatDuration', () => {
  it('formats seconds, minutes and hours', () => {
    expect(formatDuration(4_400)).toBe('4s');
    expect(formatDuration(61_000)).toBe('1m 1s');
    expect(formatDuration(3_725_000)).toBe('1h 2m');
  });
});
