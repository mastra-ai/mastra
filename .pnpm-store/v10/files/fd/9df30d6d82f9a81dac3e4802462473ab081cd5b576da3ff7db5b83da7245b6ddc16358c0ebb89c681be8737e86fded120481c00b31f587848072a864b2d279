import { ComponentPropsWithoutRef, ElementType, forwardRef } from "react";
import classNames from "classnames";
import { ComponentRef } from "react";

export const withDefaultProps =
  <TProps extends { className?: string }>({
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

export const withDefaults = <TComponent extends ElementType>(
  Component: TComponent,
  defaultProps: Partial<ComponentPropsWithoutRef<TComponent>>,
) => {
  type TComponentProps = typeof defaultProps;
  const getProps = withDefaultProps<TComponentProps>(defaultProps);
  const WithDefaults = forwardRef<ComponentRef<TComponent>, TComponentProps>(
    (props, ref) => {
      const ComponentAsAny = Component as any;
      return <ComponentAsAny {...getProps(props as any)} ref={ref} />;
    },
  );
  WithDefaults.displayName =
    "withDefaults(" +
    (typeof Component === "string" ? Component : Component.displayName) +
    ")";
  return WithDefaults;
};
