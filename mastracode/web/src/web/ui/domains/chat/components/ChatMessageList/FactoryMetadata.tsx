export function FactoryMetadata({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex min-w-0 gap-2">
      <dt className="min-w-24 shrink-0 text-icon2">{label}</dt>
      <dd className="m-0 min-w-0 wrap-anywhere text-icon5">{value}</dd>
    </div>
  );
}
