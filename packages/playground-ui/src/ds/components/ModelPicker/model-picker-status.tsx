import { Skeleton } from '@/ds/components/Skeleton';

export function ModelPickerLoading() {
  return <Skeleton role="status" aria-label="Loading model" className="h-3.5 w-24" />;
}

export function ModelPickerUnavailable({ error }: { error: string }) {
  return (
    <span className="text-accent2" aria-label="Model unavailable" title={error}>
      Model unavailable
    </span>
  );
}

export function ModelPickerReadOnly({
  label,
  value,
  notConfigured,
}: {
  label: string;
  value?: string;
  notConfigured?: boolean;
}) {
  return (
    <span
      className={notConfigured ? 'text-accent2' : 'text-neutral3'}
      aria-label={notConfigured ? `${label} is not configured` : undefined}
      title={value}
    >
      {label}
      {notConfigured ? ' · not configured' : null}
    </span>
  );
}
