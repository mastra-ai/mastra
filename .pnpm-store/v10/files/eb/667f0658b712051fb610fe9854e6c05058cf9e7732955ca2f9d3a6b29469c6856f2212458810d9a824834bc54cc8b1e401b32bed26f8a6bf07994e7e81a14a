import classNames from "classnames";

export const withDefaultProps =
  <TProps extends { className?: string | undefined }>({
    className,
    ...defaultProps
  }: Partial<TProps>) =>
  ({ className: classNameProp, ...props }: TProps) => {
    return {
      className: classNames(className, classNameProp),
      ...defaultProps,
      ...props,
    } as TProps;
  };
