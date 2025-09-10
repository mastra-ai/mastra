import { cn } from '@/lib/utils';

export function getRepoName(githubUrl: string) {
  return githubUrl.replace(/\/$/, '').split('/').pop();
}

type ContainerProps = { children: React.ReactNode; className?: string };

export function Container({ children, className }: ContainerProps) {
  return (
    <div
      className={cn(
        'border border-border1 rounded-lg mt-[3rem] py-[2rem] lg:min-h-[25rem] transition-height px-[1rem] lg:px-[3rem]',
        className,
      )}
    >
      {children}
    </div>
  );
}
