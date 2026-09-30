import { PLANS } from './cast';
import type { Story } from './stories';
import type { StoryState } from './storyState';
import { COMPANY_KEYS_ONLY, EACH_OWNER_PAYS } from './storyState';

export const CLOUDFLARE_LANES: StoryState['laneModels'] = {
  triage: { model: 'Haiku 4.5', thinking: 'low' },
  planning: { model: 'Opus 5.5', thinking: 'high' },
  execute: { model: 'Sonnet 5.5', thinking: 'medium' },
  review: { model: 'Opus 5.5', thinking: 'xhigh' },
};

export const ONBOARDING_STORIES: Story[] = [
  {
    id: 'onboarding-cloudflare',
    title: 'Onboarding: company-funded org',
    who: 'Cloudflare-sized org, admin setting up',
    steps: [
      {
        title: 'Connect GitHub and Linear',
        where: 'onboarding',
        narration: 'The admin connects the code and the issues first. Nothing runs yet, so nobody pays yet.',
        state: { onboarding: { flow: 'cloudflare', stage: 'connect' }, sharedAccount: null },
      },
      {
        title: 'One Factory account for Factory work',
        where: 'onboarding',
        narration:
          'The admin picks “One account runs everything” and adds the company Anthropic key. It is only a preset: Settings open on company keys only, with no member plan to connect and no owner’s-plan option anywhere.',
        state: {
          onboarding: { flow: 'cloudflare', stage: 'account' },
          sharedAccount: PLANS.companyAnthropicKey,
          ...COMPANY_KEYS_ONLY,
        },
      },
      {
        title: 'Land on the board with every card',
        where: 'board',
        narration:
          'The board opens empty while the open issues import. Import them from this panel: every issue lands as a card, each lane header says which model runs there.',
        state: {
          onboarding: { flow: 'cloudflare', stage: 'landed' },
          boardImported: false,
          autoRun: true,
          laneModels: CLOUDFLARE_LANES,
        },
      },
    ],
  },
  {
    id: 'onboarding-small-team',
    title: 'Onboarding: small team, own plans',
    who: 'Three people, each on their own subscription',
    steps: [
      {
        title: 'Connect GitHub',
        where: 'onboarding',
        narration: 'One connection and they are in. No org-wide provider question on the way.',
        state: {
          onboarding: { flow: 'small-team', stage: 'connect' },
          ...EACH_OWNER_PAYS,
        },
      },
      {
        title: 'Everyone brings their own plan',
        where: 'onboarding',
        narration:
          'They pick “Everyone brings their own plan”: cards run on whoever owns them. Owner lanes can’t auto-start, and the screen says so. A company key can come later.',
        state: { onboarding: { flow: 'small-team', stage: 'account' }, autoRun: true },
      },
      {
        title: 'Straight to the factory',
        where: 'board',
        narration:
          'The board opens empty with auto-start paused. Import the open issues from this panel: each card says it runs on its owner’s plan.',
        state: { onboarding: { flow: 'small-team', stage: 'landed' }, boardImported: false },
      },
    ],
  },
  {
    id: 'onboarding-solo',
    title: 'Onboarding: solo dev',
    who: 'One person, one subscription, nobody else',
    steps: [
      {
        title: 'Connect GitHub',
        where: 'onboarding',
        narration: 'Just Damien and their repositories. Nobody else will ever join this Factory.',
        state: {
          onboarding: { flow: 'solo', stage: 'connect' },
          viewer: 'damien',
          memberPlans: { shane: null, damien: PLANS.claudeMax, ward: null, grayson: null },
          ...COMPANY_KEYS_ONLY,
          sharedAccount: null,
          providerKeys: [],
        },
      },
      {
        title: 'One account: theirs',
        where: 'onboarding',
        narration:
          'Solo means the first option: “One account runs everything”. Click “Use my Claude Max” and the subscription becomes the Factory account, with a note on the provider’s terms. A company key can replace it later.',
        state: { onboarding: { flow: 'solo', stage: 'account' } },
      },
      {
        title: 'Everything runs on their Claude Max',
        where: 'board',
        narration:
          'Every lane runs on the Claude Max and auto-start works: one person, one account, nobody else to bill. Import the open issues from this panel.',
        state: {
          onboarding: { flow: 'solo', stage: 'landed' },
          sharedAccount: PLANS.claudeMax,
          boardImported: false,
          autoRun: true,
        },
      },
    ],
  },
];
