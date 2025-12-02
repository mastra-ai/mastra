// src/overrides/withDefaults.tsx
import classNames from "classnames";
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
export {
  withDefaultProps
};
//# sourceMappingURL=withDefaults.js.map