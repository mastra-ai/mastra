import { PLANS } from './cast';
import type { StoryState } from './storyState';
import { BASE_STATE } from './storyState';
import { MEMBER_PLAN_STORIES } from './memberPlanStories';
import { CLOUDFLARE_LANES, ONBOARDING_STORIES } from './onboardingStories';
import { CUSTOM_BOARD_STORY } from './workflows/customBoardStory';

export type StoryPlace = 'onboarding' | 'board' | 'session' | 'settings' | 'rules';

export type StoryStep = {
  title: string;
  narration: string;
  where: StoryPlace;
  /** Merged over the story's previous steps, so each step only states what changed. */
  state?: Partial<StoryState>;
  /** The open call this step puts on the table; the panel's knobs flip it live. */
  decision?: string;
};

export type Story = {
  id: string;
  title: string;
  who: string;
  steps: StoryStep[];
};

export const STORIES: Story[] = [
  ...ONBOARDING_STORIES,
  {
    id: 'conversation-model',
    title: 'Model, thinking and memory per conversation',
    who: 'Anyone about to send',
    steps: [
      {
        title: 'Before the first message',
        where: 'session',
        narration:
          'First time on this card: the composer already says which model, thinking level and memory model will run, and who pays, before anything is sent.',
        state: { cards: [{ author: 'grayson', owner: 'shane', lastActor: 'shane', origin: 'board' }] },
      },
      {
        title: 'Change it here, only here',
        where: 'session',
        narration:
          'Shane switches this conversation to Sonnet 5.5 at low thinking. The lane default and every other thread keep theirs; the chip says “this conversation”.',
        state: {
          cards: [
            {
              author: 'grayson',
              owner: 'shane',
              lastActor: 'shane',
              origin: 'board',
              conversationModel: { model: 'Sonnet 5.5', thinking: 'low' },
            },
          ],
        },
        decision: 'Should a lane be able to enforce its model, so a conversation cannot override it (review)?',
      },
    ],
  },
  {
    id: 'memory-broken',
    title: 'Memory model breaks',
    who: 'Admin, and everyone whose thread stops',
    steps: [
      {
        title: 'Threads stop, and say why',
        where: 'session',
        narration:
          'The observational memory model lost its key. Instead of a silent hang, every thread that needs it pauses with the same reason and a link to fix it.',
        state: { memory: { model: 'Haiku 4.5', broken: true } },
      },
      {
        title: 'Fix once, retry everything',
        where: 'settings',
        narration:
          'The admin picks a working memory model in settings. One “Retry blocked threads” resumes every paused thread instead of each person finding theirs.',
        state: { memory: { model: 'Sonnet 5.5', broken: false } },
      },
    ],
  },
  {
    id: 'who-is-who',
    title: 'Author, owner, last activity, payer',
    who: 'Anyone reading the board',
    steps: [
      {
        title: 'Four facts, one card',
        where: 'board',
        narration:
          'Grayson opened the issue, Ward owns the session, Shane touched it last, the company key pays. Each card now says all four instead of one ambiguous avatar.',
        state: {
          cards: [
            { author: 'grayson', owner: 'ward', lastActor: 'shane', origin: 'board' },
            { author: 'external', owner: 'factory', lastActor: 'factory', origin: 'auto' },
            { author: 'damien', owner: 'damien', lastActor: 'damien', origin: 'board', funding: 'damien' },
          ],
        },
      },
      {
        title: 'Steering is not owning',
        where: 'session',
        narration:
          'Shane steers Ward’s card. It keeps running on the company key it started on. Ownership stays Ward’s until Shane takes it on purpose.',
      },
    ],
  },
  {
    id: 'mixed-company',
    title: 'Company funds the board, people bring their own',
    who: 'Cloudflare-sized org',
    steps: [
      {
        title: 'One Factory account for board work',
        where: 'settings',
        narration:
          'Admin connects the company Anthropic key for Factory work and allows personal sessions on personal subscriptions only: no personal keys, no company keys outside the board.',
        state: {
          sharedAccount: PLANS.companyAnthropicKey,
          factoryWorkRunsOn: 'shared',
          autoRun: true,
          laneModels: CLOUDFLARE_LANES,
          personalSessions: true,
          allowed: { subscriptions: true, personalKeys: false, companyKeys: false },
          cards: [
            { author: 'grayson', owner: 'factory', lastActor: 'factory', origin: 'auto' },
            { author: 'ward', owner: 'ward', lastActor: 'ward', origin: 'board' },
          ],
        },
      },
      {
        title: 'Model and thinking per lane',
        where: 'board',
        narration:
          'Each lane header is a picker: who pays in that lane, then its model. Haiku triages on low thinking, Opus plans on high and reviews on extra high. Building overrides the board and runs on each card owner’s plan.',
        state: { laneFunding: { execute: 'owner' } },
        decision:
          'When someone chats on a card in a Factory-paid lane, should the composer still let them pick another model for that conversation?',
      },
      {
        title: 'Damien’s own session',
        where: 'session',
        narration: 'Outside the board, Damien chats on his own ChatGPT Pro. The company never pays for it.',
        state: {
          viewer: 'damien',
          cards: [{ surface: 'chat', author: 'damien', owner: 'damien', lastActor: 'damien', origin: 'board' }],
        },
      },
      {
        title: 'Company key, off limits',
        where: 'session',
        narration:
          'Damien picks the company key in his personal session: unavailable, company keys are kept to Factory work. Allow them in settings to compare.',
        state: {
          cards: [
            {
              surface: 'chat',
              author: 'damien',
              owner: 'damien',
              lastActor: 'damien',
              origin: 'board',
              funding: 'factory',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'auto-run-stuck',
    title: 'Auto-run gets stuck',
    who: 'A factory with auto-start on',
    steps: [
      {
        title: 'The factory starts it',
        where: 'board',
        narration: 'An issue lands, auto-start picks it up. The factory owns it and the Factory account pays.',
        state: {
          autoRun: true,
          cards: [{ author: 'external', owner: 'factory', lastActor: 'factory', origin: 'auto', needsHuman: true }],
        },
      },
      {
        title: 'Shane steps in',
        where: 'session',
        narration:
          'The run needs approval. Anyone can answer a factory session; Shane’s first message makes him the owner.',
      },
      {
        title: 'Owner changed, bill did not',
        where: 'session',
        narration:
          'Shane owns it now, the company key still pays. Moving it onto his own plan is a separate, explicit action.',
        state: {
          cards: [
            {
              author: 'external',
              owner: 'shane',
              lastActor: 'shane',
              origin: 'auto',
              funding: 'factory',
              ownedFrom: 'factory',
            },
          ],
        },
      },
    ],
  },
  ...MEMBER_PLAN_STORIES,
  {
    id: 'slack',
    title: 'Slack: the destination picks the session',
    who: 'People tagging the bot',
    steps: [
      {
        title: 'Tagged in a team channel',
        where: 'session',
        narration:
          'Ward tags the bot in #eng: a public channel lands as a card on the board, a Factory session on the company key. The bot’s first reply says so.',
        state: {
          viewer: 'ward',
          cards: [{ author: 'ward', owner: 'ward', lastActor: 'ward', origin: 'slack-channel' }],
        },
      },
      {
        title: 'Direct message',
        where: 'session',
        narration:
          'Damien DMs the bot: a DM is his own session on his ChatGPT Pro, with a “Move to Factory” button in the reply.',
        state: {
          viewer: 'damien',
          cards: [{ author: 'damien', owner: 'damien', lastActor: 'damien', origin: 'slack-dm' }],
        },
      },
      {
        title: 'Ward replies in Damien’s thread',
        where: 'session',
        narration:
          'The thread keeps the plan it started on: Ward’s reply steers Damien’s session on Damien’s ChatGPT Pro. Taking it over is a separate, deliberate step.',
        state: { viewer: 'ward' },
      },
      {
        title: 'Personal sessions off',
        where: 'session',
        narration:
          'With personal sessions disabled, the DM starts a Factory session and says the company pays before it starts.',
        state: { viewer: 'damien', personalSessions: false },
      },
    ],
  },
  {
    id: 'rules-transparency',
    title: 'Why was this suggested?',
    who: 'Someone new to the factory',
    steps: [
      {
        title: 'A suggestion with a source',
        where: 'board',
        narration: 'Hovering “Suggested” names the rule that proposed it. Rules are code-only, but readable here.',
        state: {
          cards: [
            {
              author: 'grayson',
              owner: 'factory',
              lastActor: 'factory',
              origin: 'auto',
              suggestedBy: 'investigate-needs-approval',
            },
          ],
        },
      },
      {
        title: 'Read-only rules',
        where: 'rules',
        narration: 'The rules page lists every rule the factory runs, in plain words, with where to change it.',
      },
    ],
  },
  CUSTOM_BOARD_STORY,
];

export function storyState(story: Story, stepIndex: number): StoryState {
  return story.steps
    .slice(0, stepIndex + 1)
    .reduce<StoryState>((state, step) => ({ ...state, ...step.state }), BASE_STATE);
}
