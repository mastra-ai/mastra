'use client';

interface TemplateEmptyStateProps {
  message: string;
}

export function TemplateEmptyState({ message }: TemplateEmptyStateProps) {
  return (
    <div className="rounded-md border border-border1 border-dashed bg-surface2 px-4 py-6">
      <p className="text-ui-sm text-neutral3 text-center">{message}</p>
    </div>
  );
}
