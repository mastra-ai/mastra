import { FolderGit2 } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { IconCircleCheck } from '@/ds/icons/central/IconCircleCheck';
import { IconColumns3 } from '@/ds/icons/central/IconColumns3';
import { IconFontStyle } from '@/ds/icons/central/IconFontStyle';
import { IconHashtag } from '@/ds/icons/central/IconHashtag';
import { IconMerged } from '@/ds/icons/central/IconMerged';
import { IconPlugin1 } from '@/ds/icons/central/IconPlugin1';
import { IconPullRequest } from '@/ds/icons/central/IconPullRequest';
import { IconShieldCheck } from '@/ds/icons/central/IconShieldCheck';
import { IconTag } from '@/ds/icons/central/IconTag';
import { IconUser } from '@/ds/icons/central/IconUser';
import { IconUserDuo } from '@/ds/icons/central/IconUserDuo';
import { IconZap } from '@/ds/icons/central/IconZap';
import { CircleDotIcon } from '@/ds/icons/CircleDotIcon';

/** The icon beside each condition field's name. */
export const FIELD_ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  'item.labels': IconTag,
  'item.title': IconFontStyle,
  'item.author': IconUser,
  'item.key': IconHashtag,
  'item.state': CircleDotIcon,
  'item.assignees': IconUserDuo,
  'item.pullRequest': IconPullRequest,
  'item.trusted': IconShieldCheck,
  'pullRequest.trusted': IconShieldCheck,
  'source.kind': IconPullRequest,
  'source.integration': IconPlugin1,
  'source.provider': IconPlugin1,
  'source.repository': FolderGit2,
  'pullRequest.closesIssue': IconMerged,
  'closedIssue.phase': IconColumns3,
  'closedIssue.hasPullRequest': IconPullRequest,
  'event.type': IconZap,
  'event.reason': IconCircleCheck,
};
