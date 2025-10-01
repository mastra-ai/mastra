import { Button } from '@/ds/components/Button/Button';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons';
import { Check, CircleSlash } from 'lucide-react';

export const ToolApproval = () => {
  return (
    <div className="bg-surface3 p-4 rounded-md px-3 py-2">
      <Txt variant="ui-sm" className="text-icon3">
        You are about to execute at tool.
      </Txt>

      <div className="flex gap-2 items-center pt-2">
        <Button>
          <Icon>
            <CircleSlash />
          </Icon>
          Reject
        </Button>
        <Button>
          <Icon>
            <Check />
          </Icon>
          Approve
        </Button>
      </div>
    </div>
  );
};
