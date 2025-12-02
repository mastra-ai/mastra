// src/ui/utils/withDefaults.tsx
import { forwardRef } from "react";
import classNames from "classnames";
import { jsx } from "react/jsx-runtime";
var withDefaultProps = ({
  className,
  ...defaultProps
}) => ({ className: classNameProp, ...props }) => {
  return {
    className: classNames(className, classNameProp),
    ...defaultProps,
    ...props
  };
};
var withDefaults = (Component, defaultProps) => {
  const getProps = withDefaultProps(defaultProps);
  const WithDefaults = forwardRef(
    (props, ref) => {
      const ComponentAsAny = Component;
      return /* @__PURE__ */ jsx(ComponentAsAny, { ...getProps(props), ref });
    }
  );
  WithDefaults.displayName = "withDefaults(" + (typeof Component === "string" ? Component : Component.displayName) + ")";
  return WithDefaults;
};
export {
  withDefaultProps,
  withDefaults
};
//# sourceMappingURL=withDefaults.mjs.map