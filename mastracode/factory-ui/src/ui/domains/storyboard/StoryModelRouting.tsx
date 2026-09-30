import { Txt } from '@mastra/playground-ui/components/Txt';
import { Lock } from 'lucide-react';

import { SettingsSubsection } from '../settings/components/SettingsSubsection';
import { PrototypeBadge } from './StoryChoices';
import type { Storyboard } from './StoryboardProvider';
import { useScrollToHash } from './StoryExplain';
import { StoryPayPolicy } from './StoryPayPolicy';
import { StoryRunsOnChoice } from './StoryFactoryWorkSettings';
import { PolicyBlock } from './StorySettingControls';
import { FactoryAccounts, PersonalAccounts } from './StoryRoutingAccounts';
import { StoryBackground, StoryFactoryConversations, StoryPersonalConversations } from './StoryRoutingBlocks';
import { StorySessionPolicySettings } from './StorySessionPolicySettings';
import { useStorySettingsScope } from './StorySettingsScope';
import { settingsAnchorId } from './storyLinks';
import { ownPlansAllowed } from './storyState';

function MemberLockNotice() {
  return (
    <Txt as="p" variant="meta" tone="muted" className="flex items-center gap-1.5">
      <Lock size={12} aria-hidden />
      View only: Factory admins change these settings.
    </Txt>
  );
}

function FactoryRouting({ storyboard }: { storyboard: Storyboard }) {
  const member = storyboard.state.viewerRole === 'member';
  return (
    <fieldset disabled={member} inert={member} className="flex min-w-0 flex-col gap-6">
      {member && <MemberLockNotice />}
      <StoryPayPolicy storyboard={storyboard} />
      <FactoryAccounts storyboard={storyboard} />
      {ownPlansAllowed(storyboard.state) && (
        <PolicyBlock title="Board work">
          <StoryRunsOnChoice storyboard={storyboard} />
        </PolicyBlock>
      )}
      <StorySessionPolicySettings storyboard={storyboard} />
      <StoryFactoryConversations storyboard={storyboard} />
      <StoryBackground storyboard={storyboard} />
    </fieldset>
  );
}

function PersonalRouting({ storyboard }: { storyboard: Storyboard }) {
  return (
    <div className="flex flex-col gap-6">
      <PolicyBlock id={settingsAnchorId('my-plan')} title="Accounts">
        <PersonalAccounts storyboard={storyboard} />
      </PolicyBlock>
      <StoryPersonalConversations storyboard={storyboard} />
    </div>
  );
}

export function StoryModelRouting({ storyboard }: { storyboard: Storyboard }) {
  const scope = useStorySettingsScope() ?? 'personal';
  useScrollToHash(true);
  return (
    <SettingsSubsection title="Model routing" scope={scope} action={<PrototypeBadge />}>
      {scope === 'factory' ? <FactoryRouting storyboard={storyboard} /> : <PersonalRouting storyboard={storyboard} />}
    </SettingsSubsection>
  );
}
