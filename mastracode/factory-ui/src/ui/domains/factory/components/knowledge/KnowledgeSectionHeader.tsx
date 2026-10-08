import { Txt } from '@mastra/playground-ui/components/Txt';
import { CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { ChevronDown } from 'lucide-react';
export function KnowledgeSectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <CollapsibleTrigger className="group border-border flex w-full items-center gap-2 border-t px-4 py-3 text-left">
      <Txt as="span" variant="subheading" tone="ink">
        {title}
      </Txt>
      {count !== undefined ? (
        <span className="bg-fill rounded-full px-1.5 py-0.5">
          <Txt as="span" variant="meta" tone="muted">
            {count}
          </Txt>
        </span>
      ) : null}
      <ChevronDown
        size={14}
        className="text-muted-foreground ml-auto transition-transform group-data-[state=open]:rotate-180"
      />
    </CollapsibleTrigger>
  );
}
