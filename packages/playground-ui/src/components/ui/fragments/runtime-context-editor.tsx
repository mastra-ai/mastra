import { Txt } from '@/ds/components/Txt';
import { Button } from '@/ds/components/Button';

import { BracesIcon, CopyIcon, ExternalLinkIcon } from 'lucide-react';
import { Icon } from '@/ds/icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip';

type RuntimeContextEditorProps = {
  className?: string;
  style?: React.CSSProperties;
  Link?: any;
  formatRuntimeContext: () => void;
  handleCopy: () => void;
  handleSaveRuntimeContext: () => void;
  children?: React.ReactNode;
};

export function RuntimeContextEditor({
  formatRuntimeContext,
  handleCopy,
  handleSaveRuntimeContext,
  children,
}: RuntimeContextEditorProps) {
  const buttonClass = 'text-icon3 hover:text-icon6';

  return (
    <>
      <div className="pt-5">
        <div className="flex items-center justify-between pb-2">
          <Txt as="label" variant="ui-md" className="text-icon3">
            Runtime Context (JSON)
          </Txt>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={formatRuntimeContext} className={buttonClass}>
                  <Icon>
                    <BracesIcon />
                  </Icon>
                </button>
              </TooltipTrigger>
              <TooltipContent>Format the Runtime Context JSON</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={handleCopy} className={buttonClass}>
                  <Icon>
                    <CopyIcon />
                  </Icon>
                </button>
              </TooltipTrigger>
              <TooltipContent>Copy Runtime Context</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {children}
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSaveRuntimeContext}>Save</Button>
      </div>
    </>
  );
}
