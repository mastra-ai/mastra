import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { Bot, User, Zap } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

import type { FactoryMentionMember } from '../../../../services/members';

const ACTOR_GLYPHS: Array<[string, ComponentType<SVGProps<SVGSVGElement>>]> = [
  ['agent:', Bot],
  ['github:', GithubIcon],
  ['factory-', Zap],
];

/** Only `github:` carries a name; an agent id is a uuid and a WorkOS id off the roster is worse than no name, so both read as a word. */
function actorName(by: string | undefined, roster: Map<string, FactoryMentionMember>): string {
  if (by === undefined) return 'Someone';
  if (by.startsWith('agent:')) return 'Agent';
  if (by.startsWith('github:')) return by.slice('github:'.length) || 'GitHub';
  if (by.startsWith('factory-')) return 'A rule';
  return roster.get(by)?.name ?? 'Someone';
}

function ActorMark({ by, avatarUrl, name }: { by: string | undefined; avatarUrl: string | undefined; name: string }) {
  if (avatarUrl !== undefined) return <Avatar src={avatarUrl} name={name} size="sm" />;

  const Glyph = ACTOR_GLYPHS.find(([prefix]) => by?.startsWith(prefix))?.[1] ?? User;

  return (
    <span className="border-border bg-card text-muted-foreground h-avatar-sm w-avatar-sm grid shrink-0 place-items-center rounded-full border">
      <Glyph className="size-[13px]" aria-hidden />
    </span>
  );
}

export function EntryActor({
  by,
  roster,
  compact,
}: {
  by: string | undefined;
  roster: Map<string, FactoryMentionMember>;
  compact: boolean;
}) {
  const name = actorName(by, roster);

  return (
    <>
      {compact ? null : <ActorMark by={by} avatarUrl={roster.get(by ?? '')?.avatarUrl} name={name} />}
      <Txt as="span" variant="column" tone="ink" className="shrink-0">
        {name}
      </Txt>
    </>
  );
}
