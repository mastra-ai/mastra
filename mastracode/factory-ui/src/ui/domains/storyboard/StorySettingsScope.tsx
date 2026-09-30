import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Tab, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Building2 } from 'lucide-react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';

import { actorName } from './cast';
import { useSettingsSection } from '../settings/hooks/useSettingsSection';
import { useStoryboard } from './StoryboardProvider';
import type { StoryScope } from './storyScopePaths';
import { scopeOf, switchScopePath } from './storyScopePaths';

export function useStorySettingsScope(): StoryScope | null {
  const storyboard = useStoryboard();
  const section = useSettingsSection();
  const [params] = useSearchParams();
  if (storyboard === null) return null;
  return scopeOf(section, params.get('scope'));
}

export function StorySettingsScopeSwitch({ scope }: { scope: StoryScope }) {
  const { factoryId } = useParams<{ factoryId: string }>();
  const storyboard = useStoryboard();
  const section = useSettingsSection();
  const navigate = useNavigate();
  const location = useLocation();
  if (!factoryId || storyboard === null) return null;
  const viewerName = actorName(storyboard.state.viewer);
  return (
    <div className="border-border flex justify-center border-b pb-3">
      <Tabs<StoryScope>
        defaultTab={scope}
        value={scope}
        onValueChange={next => navigate(switchScopePath(factoryId, section, next), { state: location.state })}
      >
        <TabList variant="pill" className="rounded-xl">
          <Tab value="personal" className="h-9 gap-2 rounded-lg px-4 text-sm">
            <Avatar name={viewerName} size="sm" />
            Personal settings
          </Tab>
          <Tab value="factory" className="h-9 gap-2 rounded-lg px-4 text-sm">
            <Building2 aria-hidden className="size-4" />
            Factory settings
          </Tab>
        </TabList>
      </Tabs>
    </div>
  );
}
