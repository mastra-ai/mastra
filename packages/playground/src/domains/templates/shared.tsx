import { cn } from '@mastra/playground-ui/utils/cn';

export function getRepoName(githubUrl: string) {
  return githubUrl.replace(/\/$/, '').split('/').pop();
}

type ContainerProps = { children: React.ReactNode; className?: string };

export function Container({ children, className }: ContainerProps) {
  return (
    <div
      className={cn(
        'transition-height mt-12 rounded-lg border border-border px-4 py-5 lg:min-h-[25rem] lg:px-12',
        className,
      )}
    >
      {children}
    </div>
  );
}
