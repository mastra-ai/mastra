"use client";

import { Primitive } from "@radix-ui/react-primitive";
import { ComponentPropsWithoutRef, ComponentRef, forwardRef } from "react";

type PrimitiveDivProps = ComponentPropsWithoutRef<typeof Primitive.div>;

export namespace ThreadListPrimitiveRoot {
  export type Element = ComponentRef<typeof Primitive.div>;
  export type Props = PrimitiveDivProps;
}

export const ThreadListPrimitiveRoot = forwardRef<
  ThreadListPrimitiveRoot.Element,
  ThreadListPrimitiveRoot.Props
>((props, ref) => {
  return <Primitive.div {...props} ref={ref} />;
});

ThreadListPrimitiveRoot.displayName = "ThreadListPrimitive.Root";
