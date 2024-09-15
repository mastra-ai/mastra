'use client';

import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { cn } from '@/lib/utils';

const groups = [
  {
    label: 'smthomas',
    repos: [
      {
        label: 'gatsby-test',
        value: 'gatsby-test',
      },
    ],
  },
  {
    label: 'Kepler',
    repos: [
      {
        label: 'kepler',
        value: 'kepler',
      },
      {
        label: 'future',
        value: 'future',
      },
    ],
  },
  {
    label: 'CodeKarate',
    repos: [
      {
        label: 'audiofeed',
        value: 'audiofeed',
      },
      {
        label: 'test',
        value: 'test',
      },
    ],
  },
];

type Repo = (typeof groups)[number]['repos'][number];

type PopoverTriggerProps = React.ComponentPropsWithoutRef<typeof PopoverTrigger>;

export default function RepoSwitcher({ className }: PopoverTriggerProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedTeam, setSelectedTeam] = React.useState<Repo>(groups[0].repos[0]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select a team"
          className={cn('w-[200px] justify-between', className)}
        >
          {selectedTeam.label}
          <CaretSortIcon className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandList>
            {groups.map(group => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.repos.map(repo => (
                  <CommandItem
                    key={repo.value}
                    onSelect={() => {
                      setSelectedTeam(repo);
                      setOpen(false);
                    }}
                    className="text-sm"
                  >
                    {repo.label}
                    <CheckIcon
                      className={cn('ml-auto h-4 w-4', selectedTeam.value === repo.value ? 'opacity-100' : 'opacity-0')}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
