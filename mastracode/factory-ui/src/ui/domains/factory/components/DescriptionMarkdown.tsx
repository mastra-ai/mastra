import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import type { ComponentProps, ComponentPropsWithoutRef } from 'react';

type HeadingProps = ComponentPropsWithoutRef<'h3'> & { node?: unknown };
type Heading = 'h3' | 'h4' | 'h5' | 'h6';

function headingAt(Level: Heading) {
  return function DescriptionHeading({ node: _node, ...props }: HeadingProps) {
    return <Level {...props} />;
  };
}

function headingsBelow(first: Heading, second: Heading, rest: Heading) {
  return {
    h1: headingAt(first),
    h2: headingAt(first),
    h3: headingAt(second),
    h4: headingAt(rest),
    h5: headingAt(rest),
    h6: headingAt(rest),
  } satisfies ComponentProps<typeof MarkdownRenderer>['components'];
}

const HEADINGS_BELOW = { h2: headingsBelow('h3', 'h4', 'h5'), h3: headingsBelow('h4', 'h5', 'h6') };

export function DescriptionMarkdown({
  children,
  titleLevel,
}: {
  children: string;
  titleLevel: keyof typeof HEADINGS_BELOW;
}) {
  return (
    <MarkdownRenderer
      className="text-foreground text-caption max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
      components={HEADINGS_BELOW[titleLevel]}
    >
      {children}
    </MarkdownRenderer>
  );
}
