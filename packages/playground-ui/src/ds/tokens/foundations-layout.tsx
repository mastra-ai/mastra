import type { ReactNode } from 'react';
import { Txt } from '../components/Txt/Txt';
import { cn } from '@/lib/utils';

// Shared shell for the foundation stories, so the whole token guideline reads
// as one document: a page header, sections built from a label column plus a
// specimen area, and one way to name a token under its specimen.
// Local to this folder on purpose — it is documentation scaffolding, not part
// of the package surface, so it is not re-exported from the DS index.

interface FoundationPageProps {
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
  note?: string;
  noteAside?: string;
  children: ReactNode;
}

export const FoundationPage = ({
  eyebrow,
  title,
  description,
  aside,
  note,
  noteAside,
  children,
}: FoundationPageProps) => (
  <div className="bg-background max-w-320 px-5 sm:px-8">
    <header
      className={cn(
        'grid gap-5 border-y border-border py-6 sm:py-8',
        aside ? 'sm:grid-cols-[10rem_minmax(0,1fr)_auto]' : 'sm:grid-cols-[10rem_minmax(0,1fr)]',
      )}
    >
      <Txt variant="meta" font="mono" tone="muted" className="uppercase">
        {eyebrow}
      </Txt>
      <div className="flex max-w-180 flex-col gap-2">
        <Txt as="h1" variant="title">
          {title}
        </Txt>
        <Txt variant="body" tone="muted">
          {description}
        </Txt>
      </div>
      {aside}
    </header>

    {children}

    {(note || noteAside) && (
      <footer className="flex flex-col gap-1 py-5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8">
        {note && <Txt variant="caption">{note}</Txt>}
        {noteAside && (
          <Txt variant="caption" tone="muted">
            {noteAside}
          </Txt>
        )}
      </footer>
    )}
  </div>
);

interface FoundationSectionProps {
  label: string;
  description: string;
  /** `sidebar` bleeds the section to the page edges and repaints it, so a rung can be read on a second surface. */
  surface?: 'canvas' | 'sidebar';
  children: ReactNode;
}

export const FoundationSection = ({ label, description, surface = 'canvas', children }: FoundationSectionProps) => (
  <section
    className={cn('border-b border-border py-8', surface === 'sidebar' && '-mx-5 bg-sidebar px-5 sm:-mx-8 sm:px-8')}
  >
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[9rem_minmax(0,1fr)] lg:gap-6">
      <div className="flex flex-col gap-1">
        <Txt as="h2" variant="subheading">
          {label}
        </Txt>
        <Txt variant="caption" tone="muted">
          {description}
        </Txt>
      </div>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
    </div>
  </section>
);

export const SpecimenGroup = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-3">
    <Txt variant="column" tone="muted" className="uppercase">
      {label}
    </Txt>
    {children}
  </div>
);

export const Specimen = ({ name, note, children }: { name: string; note?: string; children: ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-2">
    {children}
    <div className="flex min-w-0 flex-col gap-0.5">
      <Txt variant="meta" font="mono" tone="muted" className="truncate" title={name}>
        {name}
      </Txt>
      {note && (
        <Txt variant="meta" tone="faint" className="truncate" title={note}>
          {note}
        </Txt>
      )}
    </div>
  </div>
);
