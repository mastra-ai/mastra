import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@mastra/playground-ui/components/Command';
import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useOverlays } from '../../../lib/overlays/overlays';
import { useChatCommands } from '../context/ChatCommandsProvider';
import { SLASH_COMMANDS } from '../services/commands';

/** A Cmd/Ctrl+K command palette over the slash-command registry. */
export function CommandPalette() {
  const { close } = useOverlays();
  const { run } = useChatCommands();

  return (
    <CommandDialog
      open
      onOpenChange={open => !open && close('palette')}
      title="Command palette"
      commandLabel="Filter commands"
      contentClassName="top-1/4 w-full max-w-xl translate-y-0 gap-0"
      commandClassName="rounded-none bg-transparent"
    >
      <CommandInput placeholder="Type a command…" />
      <CommandList className="max-h-80 p-1.5" aria-label="Commands">
        <CommandEmpty>No matching commands</CommandEmpty>
        <CommandGroup>
          {SLASH_COMMANDS.map(command => (
            <CommandItem
              key={command.name}
              value={`${command.name} ${command.args ?? ''} ${command.description}`}
              onSelect={() => {
                run(command);
                close('palette');
              }}
              className="flex-col items-start gap-0.5 rounded-md px-2 py-1.5"
            >
              <Txt as="span" variant="ui-md" font="mono" className="text-icon6">
                /{command.name}
                {command.args && <span className="text-icon3"> {command.args}</span>}
              </Txt>
              <Txt as="span" variant="ui-xs" className="text-icon3">
                {command.description}
              </Txt>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      <div className="flex items-center gap-1.5 border-t border-border1 px-3 py-2 text-icon3">
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd>
        <Txt as="span" variant="ui-xs" className="text-icon3">
          navigate
        </Txt>
        <Kbd>↵</Kbd>
        <Txt as="span" variant="ui-xs" className="text-icon3">
          run
        </Txt>
        <Kbd>esc</Kbd>
        <Txt as="span" variant="ui-xs" className="text-icon3">
          close
        </Txt>
      </div>
    </CommandDialog>
  );
}
