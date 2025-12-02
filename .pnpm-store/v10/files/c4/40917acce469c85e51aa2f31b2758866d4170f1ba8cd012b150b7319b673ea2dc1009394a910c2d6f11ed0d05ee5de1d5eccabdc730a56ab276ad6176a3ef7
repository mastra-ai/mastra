"use strict";
"use client";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  Avatar: () => Avatar,
  AvatarFallback: () => AvatarFallback,
  AvatarImage: () => AvatarImage,
  Fallback: () => Fallback,
  Image: () => Image,
  Root: () => Root,
  createAvatarScope: () => createAvatarScope
});
module.exports = __toCommonJS(index_exports);

// src/avatar.tsx
var React = __toESM(require("react"));
var import_react_context = require("@radix-ui/react-context");
var import_react_use_callback_ref = require("@radix-ui/react-use-callback-ref");
var import_react_use_layout_effect = require("@radix-ui/react-use-layout-effect");
var import_react_primitive = require("@radix-ui/react-primitive");
var import_react_use_is_hydrated = require("@radix-ui/react-use-is-hydrated");
var import_jsx_runtime = require("react/jsx-runtime");
var AVATAR_NAME = "Avatar";
var [createAvatarContext, createAvatarScope] = (0, import_react_context.createContextScope)(AVATAR_NAME);
var [AvatarProvider, useAvatarContext] = createAvatarContext(AVATAR_NAME);
var Avatar = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeAvatar, ...avatarProps } = props;
    const [imageLoadingStatus, setImageLoadingStatus] = React.useState("idle");
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      AvatarProvider,
      {
        scope: __scopeAvatar,
        imageLoadingStatus,
        onImageLoadingStatusChange: setImageLoadingStatus,
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_primitive.Primitive.span, { ...avatarProps, ref: forwardedRef })
      }
    );
  }
);
Avatar.displayName = AVATAR_NAME;
var IMAGE_NAME = "AvatarImage";
var AvatarImage = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeAvatar, src, onLoadingStatusChange = () => {
    }, ...imageProps } = props;
    const context = useAvatarContext(IMAGE_NAME, __scopeAvatar);
    const imageLoadingStatus = useImageLoadingStatus(src, imageProps);
    const handleLoadingStatusChange = (0, import_react_use_callback_ref.useCallbackRef)((status) => {
      onLoadingStatusChange(status);
      context.onImageLoadingStatusChange(status);
    });
    (0, import_react_use_layout_effect.useLayoutEffect)(() => {
      if (imageLoadingStatus !== "idle") {
        handleLoadingStatusChange(imageLoadingStatus);
      }
    }, [imageLoadingStatus, handleLoadingStatusChange]);
    return imageLoadingStatus === "loaded" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_primitive.Primitive.img, { ...imageProps, ref: forwardedRef, src }) : null;
  }
);
AvatarImage.displayName = IMAGE_NAME;
var FALLBACK_NAME = "AvatarFallback";
var AvatarFallback = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeAvatar, delayMs, ...fallbackProps } = props;
    const context = useAvatarContext(FALLBACK_NAME, __scopeAvatar);
    const [canRender, setCanRender] = React.useState(delayMs === void 0);
    React.useEffect(() => {
      if (delayMs !== void 0) {
        const timerId = window.setTimeout(() => setCanRender(true), delayMs);
        return () => window.clearTimeout(timerId);
      }
    }, [delayMs]);
    return canRender && context.imageLoadingStatus !== "loaded" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_primitive.Primitive.span, { ...fallbackProps, ref: forwardedRef }) : null;
  }
);
AvatarFallback.displayName = FALLBACK_NAME;
function resolveLoadingStatus(image, src) {
  if (!image) {
    return "idle";
  }
  if (!src) {
    return "error";
  }
  if (image.src !== src) {
    image.src = src;
  }
  return image.complete && image.naturalWidth > 0 ? "loaded" : "loading";
}
function useImageLoadingStatus(src, { referrerPolicy, crossOrigin }) {
  const isHydrated = (0, import_react_use_is_hydrated.useIsHydrated)();
  const imageRef = React.useRef(null);
  const image = (() => {
    if (!isHydrated) return null;
    if (!imageRef.current) {
      imageRef.current = new window.Image();
    }
    return imageRef.current;
  })();
  const [loadingStatus, setLoadingStatus] = React.useState(
    () => resolveLoadingStatus(image, src)
  );
  (0, import_react_use_layout_effect.useLayoutEffect)(() => {
    setLoadingStatus(resolveLoadingStatus(image, src));
  }, [image, src]);
  (0, import_react_use_layout_effect.useLayoutEffect)(() => {
    const updateStatus = (status) => () => {
      setLoadingStatus(status);
    };
    if (!image) return;
    const handleLoad = updateStatus("loaded");
    const handleError = updateStatus("error");
    image.addEventListener("load", handleLoad);
    image.addEventListener("error", handleError);
    if (referrerPolicy) {
      image.referrerPolicy = referrerPolicy;
    }
    if (typeof crossOrigin === "string") {
      image.crossOrigin = crossOrigin;
    }
    return () => {
      image.removeEventListener("load", handleLoad);
      image.removeEventListener("error", handleError);
    };
  }, [image, crossOrigin, referrerPolicy]);
  return loadingStatus;
}
var Root = Avatar;
var Image = AvatarImage;
var Fallback = AvatarFallback;
//# sourceMappingURL=index.js.map
