export function FactoryMetadata({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex gap-2">
      <dt className="min-w-24 text-icon2">{label}</dt>
      <dd className="m-0 break-words text-icon5">{value}</dd>
    </div>
  );
}
