import { cn } from '@/lib/utils';
import { SectionTitle } from './section-title';

export type SectionProps = {
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function Section({ title, children, className }: SectionProps) {
  return (
    <section className={cn('grid gap-4', className)}>
      <header>{title}</header>
      {children}
    </section>
  );
}

Section.Title = SectionTitle;
