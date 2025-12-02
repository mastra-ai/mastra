// src/utils/createActionButton.tsx
import {
  forwardRef
} from "react";
import { Primitive } from "@radix-ui/react-primitive";
import { composeEventHandlers } from "@radix-ui/primitive";
import { jsx } from "react/jsx-runtime";
var createActionButton = (displayName, useActionButton, forwardProps = []) => {
  const ActionButton = forwardRef((props, forwardedRef) => {
    const forwardedProps = {};
    const primitiveProps = {};
    Object.keys(props).forEach((key) => {
      if (forwardProps.includes(key)) {
        forwardedProps[key] = props[key];
      } else {
        primitiveProps[key] = props[key];
      }
    });
    const callback = useActionButton(forwardedProps) ?? void 0;
    return /* @__PURE__ */ jsx(
      Primitive.button,
      {
        type: "button",
        ...primitiveProps,
        ref: forwardedRef,
        disabled: primitiveProps.disabled || !callback,
        onClick: composeEventHandlers(primitiveProps.onClick, callback)
      }
    );
  });
  ActionButton.displayName = displayName;
  return ActionButton;
};
export {
  createActionButton
};
//# sourceMappingURL=createActionButton.js.map