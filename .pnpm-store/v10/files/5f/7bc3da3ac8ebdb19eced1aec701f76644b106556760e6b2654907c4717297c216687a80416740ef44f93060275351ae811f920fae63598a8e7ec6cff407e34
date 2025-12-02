import { forwardRef } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { Button, ButtonProps } from "./button";

export namespace TooltipIconButton {
  export type Props = ButtonProps & {
    tooltip: string;
    side?: "top" | "bottom" | "left" | "right";
  };
}

export const TooltipIconButton = forwardRef<
  HTMLButtonElement,
  TooltipIconButton.Props
>(({ children, tooltip, side = "bottom", ...rest }, ref) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" {...rest} ref={ref}>
          {children}
          <span className="aui-sr-only">{tooltip}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side}>{tooltip}</TooltipContent>
    </Tooltip>
  );
});

TooltipIconButton.displayName = "TooltipIconButton";
