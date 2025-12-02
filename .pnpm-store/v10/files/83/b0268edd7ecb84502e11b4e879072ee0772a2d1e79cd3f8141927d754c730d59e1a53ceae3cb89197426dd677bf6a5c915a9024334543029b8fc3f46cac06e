// src/ui/base/avatar.tsx
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { withDefaults } from "../utils/withDefaults.mjs";
import { jsx, jsxs } from "react/jsx-runtime";
var Avatar = ({ src, alt, fallback }) => {
  if (src == null && fallback == null) return null;
  return /* @__PURE__ */ jsxs(AvatarRoot, { children: [
    src != null && /* @__PURE__ */ jsx(AvatarImage, { src, alt }),
    fallback != null && /* @__PURE__ */ jsx(AvatarFallback, { children: fallback })
  ] });
};
Avatar.displayName = "Avatar";
var AvatarRoot = withDefaults(AvatarPrimitive.Root, {
  className: "aui-avatar-root"
});
AvatarRoot.displayName = "AvatarRoot";
var AvatarImage = withDefaults(AvatarPrimitive.Image, {
  className: "aui-avatar-image"
});
AvatarImage.displayName = "AvatarImage";
var AvatarFallback = withDefaults(AvatarPrimitive.Fallback, {
  className: "aui-avatar-fallback"
});
AvatarFallback.displayName = "AvatarFallback";
export {
  Avatar,
  AvatarFallback,
  AvatarImage,
  AvatarRoot
};
//# sourceMappingURL=avatar.mjs.map