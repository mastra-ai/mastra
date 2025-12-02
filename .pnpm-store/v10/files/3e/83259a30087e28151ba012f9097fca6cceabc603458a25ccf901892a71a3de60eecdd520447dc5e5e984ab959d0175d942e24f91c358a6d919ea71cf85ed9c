"use client";

import type { FC } from "react";
import { useAttachment } from "../../context/react/AttachmentContext";

export namespace AttachmentPrimitiveName {
  export type Props = Record<string, never>;
}

export const AttachmentPrimitiveName: FC<
  AttachmentPrimitiveName.Props
> = () => {
  const name = useAttachment((a) => a.name);
  return <>{name}</>;
};

AttachmentPrimitiveName.displayName = "AttachmentPrimitive.Name";
