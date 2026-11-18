import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { InfoTooltip } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

type RailMark = 'node' | 'edge' | 'none';

const RAIL_MARKS: Record<RailMark, ReactNode> = {
  node: (
    <>
      <span className="bg-border-strong h-1.5 w-px shrink-0 group-first/row:invisible @min-[30rem]:h-auto @min-[30rem]:flex-1" />
      <span className="bg-muted-foreground size-2 shrink-0 rounded-full" />
      <span className="bg-border-strong w-px flex-1 group-last/row:invisible" />
    </>
  ),
  edge: <span className="bg-border-strong w-px flex-1" />,
  none: null,
};

export const OM_ROWS = {
  messages: { rail: 'node', label: 'Messages' },
  observeAfter: { rail: 'edge', label: 'Observe after', info: 'Message tokens processed before the observer runs.' },
  observer: { rail: 'node', label: 'Observer', info: 'Summarizes the conversation into observations.' },
  reflectAfter: {
    rail: 'edge',
    label: 'Reflect after',
    info: 'Observation tokens accumulated before the reflector runs.',
  },
  reflector: { rail: 'node', label: 'Reflector', info: 'Distills observations into longer-term memory.' },
  attachments: {
    rail: 'none',
    label: 'Attachments',
    info: 'Whether attached files are included in observations.',
    controlNamesItself: true,
  },
} satisfies Record<string, { rail: RailMark } & Omit<OMRowCellsProps, 'children'>>;

export const OM_FLOW = '@container flex flex-col gap-3';

type OMRowCellsProps = {
  label: string;
  info?: string;
  controlNamesItself?: boolean;
  children?: ReactNode;
};

export function OMRow({ as: Row = 'div', rail, ...cells }: { as?: 'li' | 'div'; rail: RailMark } & OMRowCellsProps) {
  return (
    <Row className="group/row grid min-h-10 grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 @min-[30rem]:grid-cols-[2rem_6.5rem_minmax(0,20rem)]">
      <span aria-hidden="true" className="row-span-2 flex flex-col items-center self-stretch @min-[30rem]:row-span-1">
        {RAIL_MARKS[rail]}
      </span>
      <OMRowCells muted={rail !== 'node'} {...cells} />
    </Row>
  );
}

function OMRowCells({
  label,
  info,
  muted,
  controlNamesItself = false,
  children,
}: OMRowCellsProps & { muted: boolean }) {
  const plainLabel = (
    <span className="flex w-fit items-center gap-1">
      <Txt as="span" variant="column" tone={muted ? 'muted' : undefined}>
        {label}
      </Txt>
      {info ? <InfoTooltip aria-label={`About ${label}`}>{info}</InfoTooltip> : null}
    </span>
  );
  if (!children) return plainLabel;

  const control = <div className="col-start-2 pb-2 @min-[30rem]:col-start-auto @min-[30rem]:pb-0">{children}</div>;
  if (controlNamesItself) {
    return (
      <>
        {plainLabel}
        {control}
      </>
    );
  }
  return (
    <Field className="contents">
      <FieldLabel size="smaller" info={info} className={muted ? 'text-muted-foreground' : undefined}>
        {label}
      </FieldLabel>
      {control}
    </Field>
  );
}
