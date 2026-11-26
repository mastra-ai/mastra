import { SettingsDescription, SettingsTitle } from '@mastra/playground-ui/new/settings';
import type { ReactNode } from 'react';

import { isOpenedLane } from '../ruleLanes';
import type { LANE_SECTIONS } from '../ruleLanes';

export const RULE_SECTIONS = 'flex flex-col gap-8';

export function RuleSection({
  section,
  intakeChain,
  children,
}: {
  section: (typeof LANE_SECTIONS)[number];
  intakeChain: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={section.title} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <SettingsTitle>{section.title}</SettingsTitle>
        {section.events.some(isOpenedLane) ? (
          intakeChain
        ) : (
          <SettingsDescription>Only cards already on this board; other boards never see them.</SettingsDescription>
        )}
      </div>
      {children}
    </section>
  );
}
