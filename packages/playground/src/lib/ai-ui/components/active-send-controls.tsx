import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

export function ActiveSendControls({ disabled }: { disabled: boolean }) {
  const [delivery, setDelivery] = useState<'queue' | 'steer'>('queue');
  const label = delivery === 'queue' ? 'Queue' : 'Steer';
  return (
    <ButtonsGroup spacing="close">
      <Button
        type="submit"
        name="delivery"
        value={delivery}
        data-chat-submit
        variant="default"
        disabled={disabled}
        tooltip={`Enter to ${delivery}`}
      >
        {label}
      </Button>
      <DropdownMenu>
        <DropdownMenu.Trigger
          render={
            <Button type="button" size="icon-md" aria-label="Choose send behavior">
              <ChevronDown />
            </Button>
          }
        >
          <ChevronDown />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content side="top" align="end">
          <DropdownMenu.RadioGroup
            value={delivery}
            onValueChange={value => {
              if (value === 'queue' || value === 'steer') setDelivery(value);
            }}
          >
            <DropdownMenu.RadioItem value="queue">
              <div>
                <Txt>Queue</Txt>
                <Txt variant="ui-sm">Send after the current response finishes.</Txt>
              </div>
            </DropdownMenu.RadioItem>
            <DropdownMenu.RadioItem value="steer">
              <div>
                <Txt>Steer</Txt>
                <Txt variant="ui-sm">Send now to guide the current response.</Txt>
              </div>
            </DropdownMenu.RadioItem>
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu>
    </ButtonsGroup>
  );
}
