"use client";

import { ComponentPropsWithoutRef, forwardRef, type ComponentRef } from "react";
import { useAttachment } from "../../context/react/AttachmentContext";
import { Primitive } from "@radix-ui/react-primitive";

type PrimitiveDivProps = ComponentPropsWithoutRef<typeof Primitive.div>;

export namespace AttachmentPrimitiveThumb {
  export type Element = ComponentRef<typeof Primitive.div>;
  export type Props = PrimitiveDivProps;
}

export const AttachmentPrimitiveThumb = forwardRef<
  AttachmentPrimitiveThumb.Element,
  AttachmentPrimitiveThumb.Props
>((props, ref) => {
  const ext = useAttachment((a) => a.name.split(".").pop());
  return (
    <Primitive.div {...props} ref={ref}>
      .{ext}
    </Primitive.div>
  );
});

AttachmentPrimitiveThumb.displayName = "AttachmentPrimitive.Thumb";
