"use client";

import { ComponentPropsWithoutRef, forwardRef, type FC } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { TooltipIconButton } from "./base/tooltip-icon-button";
import { withDefaults } from "./utils/withDefaults";
import { useThreadConfig } from "./thread-config";
import { BranchPickerPrimitive, useThread } from "@assistant-ui/react";

const useAllowBranchPicker = (ensureCapability = false) => {
  const { branchPicker: { allowBranchPicker = true } = {} } = useThreadConfig();
  const branchPickerSupported = useThread((t) => t.capabilities.edit);
  return allowBranchPicker && (!ensureCapability || branchPickerSupported);
};

const BranchPicker: FC = () => {
  const allowBranchPicker = useAllowBranchPicker(true);
  if (!allowBranchPicker) return null;
  return (
    <BranchPickerRoot hideWhenSingleBranch>
      <BranchPickerPrevious />
      <BranchPickerState />
      <BranchPickerNext />
    </BranchPickerRoot>
  );
};

BranchPicker.displayName = "BranchPicker";

const BranchPickerRoot = withDefaults(BranchPickerPrimitive.Root, {
  className: "aui-branch-picker-root",
});

BranchPickerRoot.displayName = "BranchPickerRoot";

namespace BranchPickerPrevious {
  export type Element = BranchPickerPrimitive.Previous.Element;
  export type Props = Partial<TooltipIconButton.Props>;
}

const BranchPickerPrevious = forwardRef<
  BranchPickerPrevious.Element,
  BranchPickerPrevious.Props
>((props, ref) => {
  const {
    strings: {
      branchPicker: { previous: { tooltip = "Previous" } = {} } = {},
    } = {},
  } = useThreadConfig();
  const allowBranchPicker = useAllowBranchPicker();
  return (
    <BranchPickerPrimitive.Previous disabled={!allowBranchPicker} asChild>
      <TooltipIconButton tooltip={tooltip} {...props} ref={ref}>
        {props.children ?? <ChevronLeftIcon />}
      </TooltipIconButton>
    </BranchPickerPrimitive.Previous>
  );
});

BranchPickerPrevious.displayName = "BranchPickerPrevious";

const BranchPickerStateWrapper = withDefaults("span", {
  className: "aui-branch-picker-state",
});

namespace BranchPickerState {
  export type Element = HTMLSpanElement;
  export type Props = ComponentPropsWithoutRef<"span">;
}

const BranchPickerState = forwardRef<
  BranchPickerState.Element,
  BranchPickerState.Props
>((props, ref) => {
  return (
    <BranchPickerStateWrapper {...props} ref={ref}>
      <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
    </BranchPickerStateWrapper>
  );
});

BranchPickerState.displayName = "BranchPickerState";

namespace BranchPickerNext {
  export type Element = BranchPickerPrimitive.Next.Element;
  export type Props = Partial<TooltipIconButton.Props>;
}

const BranchPickerNext = forwardRef<
  BranchPickerNext.Element,
  BranchPickerNext.Props
>((props, ref) => {
  const {
    strings: { branchPicker: { next: { tooltip = "Next" } = {} } = {} } = {},
  } = useThreadConfig();
  const allowBranchPicker = useAllowBranchPicker();
  return (
    <BranchPickerPrimitive.Next disabled={!allowBranchPicker} asChild>
      <TooltipIconButton tooltip={tooltip} {...props} ref={ref}>
        {props.children ?? <ChevronRightIcon />}
      </TooltipIconButton>
    </BranchPickerPrimitive.Next>
  );
});

BranchPickerNext.displayName = "BranchPickerNext";

const exports = {
  Root: BranchPickerRoot,
  Previous: BranchPickerPrevious,
  Next: BranchPickerNext,
};

export default Object.assign(BranchPicker, exports) as typeof BranchPicker &
  typeof exports;
