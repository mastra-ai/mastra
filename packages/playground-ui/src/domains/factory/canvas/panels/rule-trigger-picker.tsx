import { StaticPill } from '../flow-parts';
import type { RuleTriggerSection, RuleTriggerText } from './types';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { IconChevronDownMedium } from '@/ds/icons/central/IconChevronDownMedium';
import { IconCircleDashed } from '@/ds/icons/central/IconCircleDashed';
import { GithubIcon } from '@/ds/icons/GithubIcon';

/** The rule's triggers as one pill; a menu of every trigger, by who its rules see, picks several. */
export function TriggerPicker<Event extends string>({
  value,
  sections,
  describe,
  disabled,
  onChange,
}: {
  value: readonly Event[];
  sections: readonly RuleTriggerSection<Event>[];
  describe: (event: Event) => RuleTriggerText;
  disabled: boolean;
  onChange: (on: Event[]) => void;
}) {
  const first = value[0];
  const FirstIcon = first ? describe(first).icon : IconCircleDashed;
  const label = (
    <>
      <FirstIcon className="size-icon-xs shrink-0" aria-hidden />
      <span className="truncate">{first ? describe(first).label : 'Pick a trigger'}</span>
      {value.length > 1 && <span className="shrink-0 text-muted-foreground">+{value.length - 1}</span>}
    </>
  );

  if (disabled) return <StaticPill>{label}</StaticPill>;

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger variant="default" size="sm" aria-label="When" className="max-w-full min-w-0">
        {label}
        <IconChevronDownMedium className="size-icon-xs shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        {sections.map(section => (
          <DropdownMenu.Group key={section.title}>
            <DropdownMenu.Label>{section.title}</DropdownMenu.Label>
            {section.events.map(event => {
              const text = describe(event);
              const Icon = text.icon;
              const selected = value.includes(event);
              return (
                <DropdownMenu.CheckboxItem
                  key={event}
                  checked={selected}
                  // The last trigger stays: a rule listens for something.
                  disabled={selected && value.length === 1}
                  onCheckedChange={checked =>
                    onChange(checked ? [...value, event] : value.filter(other => other !== event))
                  }
                >
                  <Icon aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{text.label}</span>
                  {text.githubOnly && (
                    <>
                      <GithubIcon className="size-icon-xs shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="sr-only">GitHub only</span>
                    </>
                  )}
                </DropdownMenu.CheckboxItem>
              );
            })}
          </DropdownMenu.Group>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
