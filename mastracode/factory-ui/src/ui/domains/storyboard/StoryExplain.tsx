import { Button } from '@mastra/playground-ui/components/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ArrowRight } from 'lucide-react';
import { useEffect } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';

import type { SettingsAnchor } from './storyLinks';
import { SETTINGS_ANCHOR_TITLES, storyRulePath, storySettingsPath, storyWorkflowPath } from './storyLinks';
import { scopedSectionPath } from './storyScopePaths';

export function StoryExplain({
  trigger,
  title,
  children,
  actions,
}: {
  trigger: ReactElement;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="start" className="flex w-72 flex-col gap-2 p-3">
        <Txt as="p" variant="label" tone="ink">
          {title}
        </Txt>
        <Txt as="div" variant="meta" tone="muted" className="flex flex-col gap-1.5">
          {children}
        </Txt>
        {actions && <div className="border-border flex flex-col gap-1 border-t pt-2">{actions}</div>}
      </PopoverContent>
    </Popover>
  );
}

function StoryLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Button size="sm" className="self-start" render={<Link to={to} />}>
      {children}
      <ArrowRight aria-hidden />
    </Button>
  );
}

export function StorySettingsLink({ anchor, children }: { anchor: SettingsAnchor; children?: ReactNode }) {
  const { factoryId = '' } = useParams<{ factoryId: string }>();
  return (
    <StoryLink to={storySettingsPath(factoryId, anchor)}>
      {children ?? `Change in Settings · ${SETTINGS_ANCHOR_TITLES[anchor]}`}
    </StoryLink>
  );
}

export function StorySkillsLink({ children }: { children: ReactNode }) {
  const { factoryId = '' } = useParams<{ factoryId: string }>();
  return <StoryLink to={scopedSectionPath(factoryId, 'skills', 'factory')}>{children}</StoryLink>;
}

export function StoryRuleLink({ ruleId, children }: { ruleId?: string; children?: ReactNode }) {
  const { factoryId = '' } = useParams<{ factoryId: string }>();
  return <StoryLink to={storyRulePath(factoryId, ruleId)}>{children ?? 'See it on the Rules page'}</StoryLink>;
}

export function StoryWorkflowLink({ workflowId, children }: { workflowId?: string; children: ReactNode }) {
  const { factoryId = '' } = useParams<{ factoryId: string }>();
  return <StoryLink to={storyWorkflowPath(factoryId, workflowId)}>{children}</StoryLink>;
}

export function useScrollToHash(ready: boolean): string {
  const { hash } = useLocation();
  useEffect(() => {
    if (!ready || !hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [hash, ready]);
  return hash.slice(1);
}
