import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { useState } from 'react';

import { Composer } from './Composer';
import { GoalPanel } from './GoalPanel';
import { StatusLine } from './StatusLine';

const composerPanelClass = 'w-full shrink-0';

type ComposerPanelProps = {
  composerVariant?: 'inline' | 'textarea';
};

type ComposerTab = 'chat' | 'goal';

export function ComposerPanel({ composerVariant = 'inline' }: ComposerPanelProps) {
  const [chatDraft, setChatDraft] = useState('');
  const [goalDraft, setGoalDraft] = useState('');

  return (
    <div className={composerPanelClass}>
      <Tabs<ComposerTab> defaultTab="chat">
        <TabList variant="pill-ghost" className="px-4">
          <Tab value="chat">Chat</Tab>
          <Tab value="goal">Goal</Tab>
        </TabList>
        <TabContent value="chat" className="px-4">
          <Composer variant={composerVariant} draft={chatDraft} onDraftChange={setChatDraft} />
        </TabContent>
        <TabContent value="goal" className="px-4">
          <GoalPanel composerVariant={composerVariant} draft={goalDraft} onDraftChange={setGoalDraft} />
        </TabContent>
      </Tabs>
      <StatusLine />
    </div>
  );
}
