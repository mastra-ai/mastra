import type { FC } from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { withDefaults } from "../utils/withDefaults";

export type AvatarProps = {
  src?: string | undefined;
  alt?: string | undefined;
  fallback?: string | undefined;
};

export const Avatar: FC<AvatarProps> = ({ src, alt, fallback }) => {
  if (src == null && fallback == null) return null;

  return (
    <AvatarRoot>
      {src != null && <AvatarImage src={src} alt={alt} />}
      {fallback != null && <AvatarFallback>{fallback}</AvatarFallback>}
    </AvatarRoot>
  );
};

Avatar.displayName = "Avatar";

export const AvatarRoot = withDefaults(AvatarPrimitive.Root, {
  className: "aui-avatar-root",
});

AvatarRoot.displayName = "AvatarRoot";

export const AvatarImage = withDefaults(AvatarPrimitive.Image, {
  className: "aui-avatar-image",
});

AvatarImage.displayName = "AvatarImage";

export const AvatarFallback = withDefaults(AvatarPrimitive.Fallback, {
  className: "aui-avatar-fallback",
});

AvatarFallback.displayName = "AvatarFallback";
