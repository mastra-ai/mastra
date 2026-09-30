import { PLANS } from './cast';
import type { Story } from './stories';

export const MEMBER_PLAN_STORIES: Story[] = [
  {
    id: 'teammates-plan',
    title: 'Steering Ward’s session',
    who: 'Anyone messaging a teammate’s work',
    steps: [
      {
        title: 'Shane steers, Ward’s plan pays',
        where: 'session',
        narration:
          'Multiplayer by default, no setting. Shane messages Ward’s running session: it steers Ward’s agent on Ward’s Claude Max, the plan it started on. The first time, the composer explains it once.',
        state: {
          factoryWorkRunsOn: 'owner',
          steerHintSeen: false,
          cards: [
            {
              author: 'grayson',
              owner: 'ward',
              lastActor: 'ward',
              origin: 'board',
              running: true,
              sessionModel: { model: 'Opus 5.5', provider: 'anthropic' },
            },
          ],
        },
      },
      {
        title: 'The model is locked while it runs',
        where: 'session',
        narration:
          'The chip shows a lock. Changing it is deliberate: it breaks the prompt cache and applies next turn. Only models Ward’s Claude Max supports are offered; other providers need Ward’s account.',
        state: { steerHintSeen: true },
      },
      {
        title: 'Shane takes ownership',
        where: 'session',
        narration:
          'Deliberate, no permission needed, like reassigning in Linear. Billing moves to Shane’s Claude Max, his models apply and the prompt cache restarts. A message never does this.',
        state: {
          steerHintSeen: true,
          cards: [
            {
              author: 'grayson',
              owner: 'shane',
              lastActor: 'shane',
              origin: 'board',
              ownedFrom: 'ward',
              sessionModel: { model: 'Opus 5.5', provider: 'anthropic' },
            },
          ],
        },
      },
    ],
  },
  {
    id: 'handoff',
    title: 'Shane hands off to Damien',
    who: 'Two engineers on one card',
    steps: [
      {
        title: 'Shane did the back end',
        where: 'session',
        narration: 'Shane’s card runs on his Claude Max, Opus. Damien only has OpenAI.',
        state: {
          viewer: 'damien',
          factoryWorkRunsOn: 'owner',
          cards: [
            {
              author: 'grayson',
              owner: 'shane',
              lastActor: 'shane',
              origin: 'board',
              sessionModel: { model: 'Opus 5.5', provider: 'anthropic' },
            },
          ],
        },
      },
      {
        title: 'Moved to Damien’s plan',
        where: 'session',
        narration:
          'Damien moves it to his plan: he owns it, his ChatGPT Pro pays, the model falls back to GPT-5 and the composer says so.',
        state: {
          cards: [
            {
              author: 'grayson',
              owner: 'damien',
              lastActor: 'damien',
              origin: 'board',
              funding: 'damien',
              ownedFrom: 'shane',
              movedFrom: 'shane',
              sessionModel: { model: 'Opus 5.5', provider: 'anthropic' },
            },
          ],
        },
        decision: 'Fall back within the new payer’s own accounts, or ask them to pick?',
      },
    ],
  },
  {
    id: 'subscription-disconnected',
    title: 'My subscription disconnects',
    who: 'Anyone on a personal plan',
    steps: [
      {
        title: 'Paused, not rerouted',
        where: 'session',
        narration:
          'Damien’s ChatGPT login expired mid-card. The session pauses and asks him to reconnect. It never falls back to the company key on its own.',
        state: {
          viewer: 'damien',
          factoryWorkRunsOn: 'owner',
          memberPlans: {
            shane: PLANS.claudeMax,
            damien: { ...PLANS.chatgptPro, disconnected: true },
            ward: PLANS.claudeMax,
            grayson: null,
          },
          cards: [{ author: 'grayson', owner: 'damien', lastActor: 'damien', origin: 'board' }],
        },
      },
    ],
  },
  {
    id: 'small-team',
    title: 'Small team, no Factory account',
    who: 'Three friends trying it out',
    steps: [
      {
        title: 'Set up later',
        where: 'board',
        narration:
          'They skipped the Factory account. Cards run on whoever owns them; auto-start stays paused because with nobody around, nobody would pay.',
        state: {
          sharedAccount: null,
          factoryWorkRunsOn: 'owner',
          autoRun: true,
          viewer: 'damien',
          memberPlans: { shane: null, damien: PLANS.claudeMax, ward: null, grayson: null },
          cards: [
            { author: 'damien', owner: 'damien', lastActor: 'damien', origin: 'board' },
            { author: 'external', owner: 'factory', lastActor: 'factory', origin: 'auto' },
          ],
        },
      },
      {
        title: 'The first auto card asks',
        where: 'board',
        narration: 'The card auto-start could not run asks for a Factory account, right where the need shows up.',
        decision: 'Can a personal subscription back the Factory account, or only an API key?',
      },
      {
        title: 'Damien lends his Claude Max',
        where: 'settings',
        narration:
          'Settings → Factory keys offers “Use my Claude Max” while no key exists. One click and auto-start runs on it, next to a provider-terms warning; a company key swaps in later.',
        state: { sharedAccount: PLANS.claudeMax },
      },
      {
        title: 'Factory account connected',
        where: 'board',
        narration: 'A company key is in; auto-start resumes. Cards people start still run on their own plan.',
        state: { sharedAccount: PLANS.companyAnthropicKey },
      },
    ],
  },
];
