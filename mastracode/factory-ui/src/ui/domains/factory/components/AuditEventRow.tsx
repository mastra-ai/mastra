import type { AuditActorProfile, AuditEvent } from '../services/audit';
import { actionLabel, actorLabel, eventDetail, eventMetadata, namespaceOf, NAMESPACE_PAINT } from '../audit-log';

const COLUMNS = 'grid grid-cols-[6.5rem_minmax(0,1fr)] md:grid-cols-[6.5rem_8rem_9.5rem_minmax(0,12rem)_minmax(0,1fr)]';

/** One line per event: when, who, what, on what — the log reads by scanning columns. */
export function AuditEventRow({
  event,
  actor,
  stamp,
  title,
  expanded,
  onToggle,
}: {
  event: AuditEvent;
  actor: AuditActorProfile | undefined;
  stamp: string;
  title: string | undefined;
  expanded: boolean;
  onToggle: () => void;
}) {
  const namespace = namespaceOf(event.action);
  const agent = event.actorType === 'agent';

  return (
    <li className="border-border1 border-b">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className={`text-ui-sm text-icon4 hover:bg-surface4 w-full cursor-pointer items-center gap-4 rounded-sm px-2 py-1.5 text-left transition-colors ${COLUMNS}`}
      >
        <span className="text-ui-xs text-icon2 font-mono tabular-nums">{stamp}</span>
        <span className={`text-ui-xs hidden truncate font-mono md:block ${agent ? 'text-accent3' : 'text-icon3'}`}>
          {actorLabel(event, actor?.name)}
        </span>
        <span className="text-icon5 flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className={`size-1.5 shrink-0 rounded-full ${namespace ? NAMESPACE_PAINT[namespace].dot : 'bg-icon2'}`}
          />
          <span className="truncate">{actionLabel(event.action)}</span>
        </span>
        <span className="text-ui-xs text-icon3 hidden truncate font-mono md:block">{eventDetail(event)}</span>
        <span className="text-icon3 truncate">{title ?? ''}</span>
      </button>

      {expanded ? (
        <dl className="text-ui-xs text-icon3 bg-surface2 m-0 grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-x-6 gap-y-1.5 rounded-md px-3 py-2.5 font-mono">
          <Field label="occurred">{event.occurredAt}</Field>
          <Field label="action">{event.action}</Field>
          <Field label="actor">{event.actorId}</Field>
          {event.targets.map(target => (
            <Field key={target.id} label={target.type}>
              {target.id}
            </Field>
          ))}
          {eventMetadata(event).map(([key, value]) => (
            <Field key={key} label={key}>
              {value}
            </Field>
          ))}
        </dl>
      ) : null}
    </li>
  );
}

function Field({ label, children }: { label: string; children: string }) {
  return (
    <>
      <dt className="text-icon2 truncate">{label}</dt>
      <dd className="text-icon4 m-0 break-all">{children}</dd>
    </>
  );
}
