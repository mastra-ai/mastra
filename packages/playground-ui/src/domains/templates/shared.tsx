import { cn } from '@/lib/utils';

export function getRepoName(githubUrl: string) {
  return githubUrl.replace(/\/$/, '').split('/').pop();
}

type ContainerProps = { children: React.ReactNode; className?: string };

export function Container({ children, className }: ContainerProps) {
  return (
    <div
      className={cn(
        'border border-border1 rounded-lg mt-12 py-8 lg:min-h-[25rem] transition-height px-4 lg:px-12',
        className,
      )}
    >
      {children}
    </div>
  );
}
