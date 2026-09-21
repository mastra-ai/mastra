import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

import { RunOptionsDraftProvider, useRunOptionsDraftRegistry } from '../context/run-options-draft';
import { RequestContextEditor } from '@/domains/request-context/components/request-context-editor';
import { Button } from '@/ds/components/Button';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Txt } from '@/ds/components/Txt';
import { toast } from '@/lib/toast';

/** Shared between the request context editor and any sibling editor so both columns stay the same height. */
export const RUN_OPTIONS_EDITOR_HEIGHT = 'h-[260px] md:h-[360px]';

export interface RunOptionsContentProps {
  /** Serialized JSON schema for the request context form. */
  requestContextSchema?: string;
  /** Custom request context form (takes precedence over `requestContextSchema`). */
  requestContextFormSlot?: ReactNode;
  requestContextTooltip?: string;
  /** Extra section rendered in the right column (e.g. tracing options). Single column when omitted. */
  children?: ReactNode;
  /** Called after every draft has been saved successfully. */
  onSaved?: () => void;
}

/**
 * Body of the run options popover: a request context editor plus an optional
 * second column, persisted together by a single "Save" button. Requires
 * `RequestContextProvider`. Editors register their draft via `useRunOptionsDraft`.
 *
 * Inner form submits are stopped here so they never bubble to a surrounding
 * form (e.g. a workflow trigger form) through the React tree.
 */
export function RunOptionsContent({
  requestContextSchema,
  requestContextFormSlot,
  requestContextTooltip,
  children,
  onSaved,
}: RunOptionsContentProps) {
  const { registry, isDirty, saveAll } = useRunOptionsDraftRegistry();

  const handleSave = () => {
    if (!saveAll()) return;
    toast.success('Run options saved');
    onSaved?.();
  };

  return (
    <RunOptionsDraftProvider registry={registry}>
      {/* `--available-height` comes from the Base UI popover positioner so the Save footer stays reachable. */}
      <ScrollArea className="w-full" maxHeight="min(600px, var(--available-height, calc(100dvh - 8rem)))">
        <div className="space-y-4 p-4" onSubmit={event => event.stopPropagation()}>
          <Txt as="h3" variant="ui-md" className="text-neutral3">
            Run options
          </Txt>

          <div className={children ? 'grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : 'grid gap-5'}>
            <section className="min-w-0" aria-label="Request context">
              <RequestContextEditor
                requestContextSchema={requestContextSchema}
                formSlot={requestContextFormSlot}
                labelTooltip={requestContextTooltip}
                jsonEditorClassName={RUN_OPTIONS_EDITOR_HEIGHT}
              />
            </section>

            {children ? (
              <section className="min-w-0" aria-label="Additional run options">
                {children}
              </section>
            ) : null}
          </div>

          <div className="flex justify-end">
            <Button icon={<Check />} type="button" onClick={handleSave} disabled={!isDirty}>
              Save
            </Button>
          </div>
        </div>
      </ScrollArea>
    </RunOptionsDraftProvider>
  );
}
