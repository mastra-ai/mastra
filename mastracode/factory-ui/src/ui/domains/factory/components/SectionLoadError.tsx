import { Txt } from '@mastra/playground-ui/components/Txt';

export function SectionLoadError({ children }: { children: string }) {
  return (
    <Txt variant="caption" tone="muted" className="m-0 px-2">
      {children}
    </Txt>
  );
}
