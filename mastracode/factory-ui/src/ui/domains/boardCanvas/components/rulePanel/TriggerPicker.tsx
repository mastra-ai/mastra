import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { IconChevronDownMedium } from '@mastra/playground-ui/icons/central/IconChevronDownMedium';
import { IconCircleDashed } from '@mastra/playground-ui/icons/central/IconCircleDashed';

import { LANE_SECTIONS, laneText } from '../../../boardRules/ruleLanes';
import type { RuleEvent } from '../../../boardRules/ruleLanes';
import { StaticPill } from '../conditions/flowParts';

/** What the trigger pill says: the first trigger, and how many more. */
export function triggerText(value: readonly string[]): string {
  const [first] = value;
  if (!first) return 'Pick a trigger';
  return value.length > 1 ? `${laneText(first).label} +${value.length - 1}` : laneText(first).label;
}

/** The rule's triggers as one pill; a menu of every trigger, by who its rules see, picks several. */
export function TriggerPicker({
  value,
  disabled,
  onChange,
}: {
  value: readonly RuleEvent[];
  disabled: boolean;
  onChange: (on: RuleEvent[]) => void;
}) {
  const first = value[0];
  const FirstIcon = first ? laneText(first).icon : IconCircleDashed;
  const label = (
    <>
      <FirstIcon className="size-icon-xs shrink-0" aria-hidden />
      <span className="truncate">{first ? laneText(first).label : 'Pick a trigger'}</span>
      {value.length > 1 && <span className="text-muted-foreground shrink-0">+{value.length - 1}</span>}
    </>
  );

  if (disabled) return <StaticPill>{label}</StaticPill>;

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger variant="default" size="sm" aria-label="When" className="max-w-full min-w-0">
        {label}
        <IconChevronDownMedium className="text-muted-foreground size-icon-xs shrink-0" aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        {LANE_SECTIONS.map(section => (
          <DropdownMenu.Group key={section.title}>
            <DropdownMenu.Label>{section.title}</DropdownMenu.Label>
            {section.events.map(event => {
              const text = laneText(event);
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
                      <GithubIcon className="text-muted-foreground size-icon-xs shrink-0" aria-hidden="true" />
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
