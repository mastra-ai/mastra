import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { withDefaults } from "../utils/withDefaults";
import { FC } from "react";

export const Tooltip: FC<TooltipPrimitive.TooltipProps> = (props) => {
  return (
    <TooltipPrimitive.Provider>
      <TooltipPrimitive.Root {...props} />
    </TooltipPrimitive.Provider>
  );
};

Tooltip.displayName = "Tooltip";

export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = withDefaults(TooltipPrimitive.Content, {
  sideOffset: 4,
  className: "aui-tooltip-content",
});

TooltipContent.displayName = "TooltipContent";
