import { Badge } from '@mastra/playground-ui';

import { BADGE_COLORS, BADGE_ICONS, getNodeBadgeInfo } from './workflow-card-badge-utils';
import type { WorkflowCardBadgesProps } from './workflow-card-badge-utils';

export const WorkflowCardBadges = (props: WorkflowCardBadgesProps) => {
  const { isSleepNode, isForEachNode, isMapNode, isNestedWorkflow, hasSpecialBadge } = getNodeBadgeInfo(props);

  if (!hasSpecialBadge) {
    return null;
  }

  return (
    <div className="px-3 pt-2 pb-1 flex gap-1.5 flex-wrap">
      {isSleepNode && (
        <Badge
          icon={
            props.date ? (
              <BADGE_ICONS.sleepUntil className="text-current" style={{ color: BADGE_COLORS.sleep }} />
            ) : (
              <BADGE_ICONS.sleep className="text-current" style={{ color: BADGE_COLORS.sleep }} />
            )
          }
        >
          {props.date ? 'SLEEP UNTIL' : 'SLEEP'}
        </Badge>
      )}
      {props.canSuspend && (
        <Badge icon={<BADGE_ICONS.suspend className="text-current" style={{ color: BADGE_COLORS.suspend }} />}>
          SUSPEND/RESUME
        </Badge>
      )}
      {props.isParallel && (
        <Badge icon={<BADGE_ICONS.parallel className="text-current" style={{ color: BADGE_COLORS.parallel }} />}>
          PARALLEL
        </Badge>
      )}
      {isNestedWorkflow && (
        <Badge icon={<BADGE_ICONS.workflow className="text-current" style={{ color: BADGE_COLORS.workflow }} />}>
          WORKFLOW
        </Badge>
      )}
      {isForEachNode && (
        <Badge icon={<BADGE_ICONS.forEach className="text-current" style={{ color: BADGE_COLORS.forEach }} />}>
          FOREACH
        </Badge>
      )}
      {isMapNode && (
        <Badge icon={<BADGE_ICONS.map className="text-current" style={{ color: BADGE_COLORS.map }} />}>MAP</Badge>
      )}
    </div>
  );
};
