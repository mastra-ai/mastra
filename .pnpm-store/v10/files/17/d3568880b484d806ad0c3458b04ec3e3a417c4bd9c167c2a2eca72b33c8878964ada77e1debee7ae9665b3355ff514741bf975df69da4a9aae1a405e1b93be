"use client";

import { Primitive } from "@radix-ui/react-primitive";
import { type ComponentRef, forwardRef, ComponentPropsWithoutRef } from "react";
import { If } from "../message";

export namespace BranchPickerPrimitiveRoot {
  export type Element = ComponentRef<typeof Primitive.div>;
  export type Props = ComponentPropsWithoutRef<typeof Primitive.div> & {
    /**
     * Whether to hide the branch picker when there's only one branch available.
     * When true, the component will only render when multiple branches exist.
     * @default false
     */
    hideWhenSingleBranch?: boolean | undefined;
  };
}

/**
 * The root container for branch picker components.
 *
 * This component provides a container for branch navigation controls,
 * with optional conditional rendering based on the number of available branches.
 * It integrates with the message branching system to allow users to navigate
 * between different response variations.
 *
 * @example
 * ```tsx
 * <BranchPickerPrimitive.Root hideWhenSingleBranch={true}>
 *   <BranchPickerPrimitive.Previous />
 *   <BranchPickerPrimitive.Count />
 *   <BranchPickerPrimitive.Next />
 * </BranchPickerPrimitive.Root>
 * ```
 */
export const BranchPickerPrimitiveRoot = forwardRef<
  BranchPickerPrimitiveRoot.Element,
  BranchPickerPrimitiveRoot.Props
>(({ hideWhenSingleBranch, ...rest }, ref) => {
  return (
    <If hasBranches={hideWhenSingleBranch ? true : undefined}>
      <Primitive.div {...rest} ref={ref} />
    </If>
  );
});

BranchPickerPrimitiveRoot.displayName = "BranchPickerPrimitive.Root";
