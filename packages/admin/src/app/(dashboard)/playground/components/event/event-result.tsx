'use client';

import { CodeBlockDemo } from '@/app/components/code-block';
import { useEventPlaygroundContext } from '@/domains/playground/providers/event-playground-provider';

export function EventResult() {
  const { eventRunState, eventResult } = useEventPlaygroundContext();

  return (
    <div className="p-2 pt-12 max-h-[23rem] overflow-scroll">
      {eventRunState === 'success' ? (
        <CodeBlockDemo code={eventResult} language="json" />
      ) : (
        <CodeBlockDemo code={eventResult} language="json" />
      )}
    </div>
  );
}
