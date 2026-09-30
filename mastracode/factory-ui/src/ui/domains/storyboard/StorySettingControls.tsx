import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer } from '@mastra/playground-ui/new/settings';
import type { ReactNode } from 'react';

export type SettingOption<Value extends string> = { value: Value; label: string };

export function StackedRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <Txt as="span" variant="label" tone="ink">
        {label}
      </Txt>
      {children}
    </div>
  );
}

export function PolicyBlock({
  id,
  title,
  hint,
  children,
}: {
  id?: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-label={title} className="flex scroll-mt-4 flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <Txt as="h3" variant="label" tone="ink">
          {title}
        </Txt>
        {hint && (
          <Txt as="p" variant="meta" tone="muted">
            {hint}
          </Txt>
        )}
      </div>
      <SettingsContainer>{children}</SettingsContainer>
    </section>
  );
}

export function SettingSelect<Value extends string>({
  label,
  value,
  options,
  onChange,
  className = 'w-44',
}: {
  label: string;
  value: Value;
  options: readonly SettingOption<Value>[];
  onChange: (next: Value) => void;
  className?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={next => {
        const picked = options.find(option => option.value === next);
        if (picked) onChange(picked.value);
      }}
    >
      <SelectTrigger size="sm" aria-label={label} className={className}>
        <span className="truncate">{options.find(option => option.value === value)?.label}</span>
      </SelectTrigger>
      <SelectContent>
        {options.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
