'use client';

import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons';
import * as React from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { cn } from '@/lib/utils';

type PopoverTriggerProps = React.ComponentPropsWithoutRef<typeof PopoverTrigger> & {
  repos: string[];
  defaultRepo: string;
};

export default function RepoSwitcher({ repos, defaultRepo, className }: PopoverTriggerProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [selectedTeam, setSelectedTeam] = React.useState<string>(defaultRepo);

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
          {selectedTeam}
          <CaretSortIcon className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandList>
            <CommandGroup key={process.env.GITHUB_ORG} heading={process.env.GITHUB_ORG}>
              {repos.map(repo => (
                <CommandItem
                  key={repo}
                  onSelect={() => {
                    setSelectedTeam(repo);
                    setOpen(false);
                    router.push(`/${repo}`);
                  }}
                  className="text-sm"
                >
                  {repo}
                  <CheckIcon className={cn('ml-auto h-4 w-4', selectedTeam === repo ? 'opacity-100' : 'opacity-0')} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
