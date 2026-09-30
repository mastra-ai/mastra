import { PLANS } from '../cast';
import type { Story } from '../stories';
import type { CardFacts } from '../storyState';

const SECURITY_SCAN_CARD: CardFacts = {
  author: 'grayson',
  owner: 'shane',
  lastActor: 'factory',
  origin: 'board',
  workflow: { id: 'security-review', stepIndex: 1 },
};

export const CUSTOM_BOARD_STORY: Story = {
  id: 'custom-board',
  title: 'Custom board, pinned workflow',
  who: 'A team with its own lanes and a security workflow',
  steps: [
    {
      title: 'Custom lanes join the board',
      where: 'board',
      narration:
        'Work gains a Security review lane between Building and Review, and an Incidents board joins the sidebar. Custom lanes inherit the default model until someone picks one.',
      state: { boardLayout: 'custom', providerKeys: [PLANS.companyDeepSeekKey], cards: [SECURITY_SCAN_CARD] },
    },
    {
      title: 'What runs in Security review',
      where: 'board',
      narration:
        'Board work now runs on each owner’s plan. The lane’s automations open its workflow: tests, a scan pinned to DeepSeek V4, a human sign-off. Each step says who pays.',
      state: { factoryWorkRunsOn: 'owner' },
    },
    {
      title: 'A card on the pinned step',
      where: 'board',
      narration:
        'Shane owns the card and board work runs on the owner’s plan, but the scan step is pinned to DeepSeek: it bills the Factory’s DeepSeek key. Tests and sign-off stay on his plan.',
      decision: 'Pinned steps always bill the Factory account, even when cards run on their owner’s plan?',
    },
    {
      title: 'Build a workflow',
      where: 'rules',
      narration:
        'Rules & workflows lets anyone sketch one: a trigger, then agent, tool and approval steps. Pinning a step’s model moves that step’s bill to the Factory account.',
      decision: 'Workflows built in the UI, or only in factory.config.ts like rules?',
    },
  ],
};
