"use client";

import { Primitive } from "@radix-ui/react-primitive";
import { type ComponentRef, forwardRef, ComponentPropsWithoutRef } from "react";

export namespace ErrorPrimitiveRoot {
  export type Element = ComponentRef<typeof Primitive.div>;
  export type Props = ComponentPropsWithoutRef<typeof Primitive.div>;
}

export const ErrorPrimitiveRoot = forwardRef<
  ErrorPrimitiveRoot.Element,
  ErrorPrimitiveRoot.Props
>((props, forwardRef) => {
  return <Primitive.div role="alert" {...props} ref={forwardRef} />;
});

ErrorPrimitiveRoot.displayName = "ErrorPrimitive.Root";
