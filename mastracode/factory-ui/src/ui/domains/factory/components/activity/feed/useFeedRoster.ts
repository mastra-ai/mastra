import { useFactoryMembers } from '../../../../../../hooks/useFactoryMembers';
import type { AuditEventPage } from '../../../services/audit';
import type { FactoryMentionMember } from '../../../services/members';

/** Members plus the profiles the trail ships, keyed by the actor id events carry, which can differ from a profile's own id. */
export function useFeedRoster(factoryId: string, auditPages: AuditEventPage[]): Map<string, FactoryMentionMember> {
  const members = useFactoryMembers(factoryId);
  const auditActors = auditPages.flatMap(page =>
    Object.entries(page.actors).map(([actorId, actor]): [string, FactoryMentionMember] => [
      actorId,
      { ...actor, id: actorId },
    ]),
  );
  return new Map([
    ...(members.data ?? []).map((member): [string, FactoryMentionMember] => [member.id, member]),
    ...auditActors,
  ]);
}
