/**
 * Synthetic Slack-thread decisions for the card-start eval. People, repositories
 * and requests are invented; each mirrors a kind of ask seen in Factory usage.
 */
export type Expectation =
  /** Work asked for now: the turn must start it (card move or side session), not only file a card. */
  | 'start'
  /** Asked only to file or track a card: the turn must file it and leave it unstarted. */
  | 'file-only'
  /** Asked for a side session: the turn must start one, not move a card. */
  | 'side-session';

export interface Scenario {
  id: string;
  expect: Expectation;
  /** Earlier turns of the thread, oldest first. */
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** The message the decision is made on. */
  message: string;
}

const slack = (who: string, text: string) => `[Slack #eng, ${who}] ${text}`;

export const scenarios: Scenario[] = [
  {
    id: 'fix-now',
    expect: 'start',
    history: [],
    message: slack(
      'Dana Reyes',
      '@Factory the signup form in acme/web throws "Cannot read properties of undefined" when the email field is empty. please fix',
    ),
  },
  {
    id: 'go-for-it-after-discussion',
    expect: 'start',
    history: [
      {
        role: 'user',
        content: slack('Omar Hale', '@Factory should the board auto-collapse phases nobody has opened in a week?'),
      },
      {
        role: 'assistant',
        content:
          "It could: the board already stores when each phase was last opened, so collapsing ones idle for 7 days is a small change in acme/web's board view.",
      },
    ],
    message: slack('Omar Hale', 'ok go for it'),
  },
  {
    id: 'just-do-it',
    expect: 'start',
    history: [
      {
        role: 'user',
        content: slack('Priya Natarajan', '@Factory webhook deliveries in acme/api give up after the first 5xx'),
      },
      {
        role: 'assistant',
        content:
          'Right: the sender in acme/api makes one attempt and logs the failure. Adding retries with backoff would fix it.',
      },
    ],
    message: slack('Priya Natarajan', 'yeah add retries with backoff, just do it'),
  },
  {
    id: 'file-for-next-sprint',
    expect: 'file-only',
    history: [],
    message: slack(
      'Dana Reyes',
      "@Factory can you file a card for the flaky upload test in acme/web? don't start it, we'll pick it up next sprint",
    ),
  },
  {
    id: 'track-so-we-dont-forget',
    expect: 'file-only',
    history: [],
    message: slack(
      'Omar Hale',
      "@Factory add a card to track moving acme/api to Node 24 so we don't forget. not urgent, just track it",
    ),
  },
  {
    id: 'side-session-investigation',
    expect: 'side-session',
    history: [],
    message: slack(
      'Priya Natarajan',
      '@Factory spin up a side session to investigate why acme/web CI build times doubled since last Monday',
    ),
  },
  {
    id: 'side-session-pr-fix',
    expect: 'side-session',
    history: [],
    message: slack(
      'Dana Reyes',
      '@Factory in a side session, push a fix for the lint error failing CI on https://github.com/acme/web/pull/812',
    ),
  },
];
