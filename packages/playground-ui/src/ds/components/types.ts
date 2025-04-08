export type PolymorphicRef<C extends React.ElementType> = React.ComponentPropsWithRef<C>['ref'];

export type PolymorphicComponentProps<C extends React.ElementType, Props = {}> = Props &
  Omit<React.ComponentPropsWithoutRef<C>, keyof Props> & {
    ref?: PolymorphicRef<C>;
  };
