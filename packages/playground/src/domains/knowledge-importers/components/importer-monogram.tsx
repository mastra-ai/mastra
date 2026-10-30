import { Txt } from '@mastra/playground-ui/components/Txt';

const TILE_SIZE = { sm: 'size-8 rounded-lg', lg: 'size-11 rounded-xl' } as const;

/** Neutral initial tile; the repo has no slug-keyed provider icon set to draw from. */
export function ImporterMonogram({ label, size }: { label: string; size: keyof typeof TILE_SIZE }) {
  return (
    <span
      aria-hidden
      className={`${TILE_SIZE[size]} grid shrink-0 place-items-center border border-border bg-fill-subtle text-muted-foreground`}
    >
      <Txt as="span" variant={size === 'lg' ? 'subheading' : 'label'}>
        {label.charAt(0).toUpperCase()}
      </Txt>
    </span>
  );
}
