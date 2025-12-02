import * as _radix_ui_react_context from '@radix-ui/react-context';
import * as React from 'react';
import { Primitive } from '@radix-ui/react-primitive';

declare const createCollapsibleScope: _radix_ui_react_context.CreateScope;
type PrimitiveDivProps = React.ComponentPropsWithoutRef<typeof Primitive.div>;
interface CollapsibleProps extends PrimitiveDivProps {
    defaultOpen?: boolean;
    open?: boolean;
    disabled?: boolean;
    onOpenChange?(open: boolean): void;
}
declare const Collapsible: React.ForwardRefExoticComponent<CollapsibleProps & React.RefAttributes<HTMLDivElement>>;
type PrimitiveButtonProps = React.ComponentPropsWithoutRef<typeof Primitive.button>;
interface CollapsibleTriggerProps extends PrimitiveButtonProps {
}
declare const CollapsibleTrigger: React.ForwardRefExoticComponent<CollapsibleTriggerProps & React.RefAttributes<HTMLButtonElement>>;
interface CollapsibleContentProps extends Omit<CollapsibleContentImplProps, 'present'> {
    /**
     * Used to force mounting when more control is needed. Useful when
     * controlling animation with React animation libraries.
     */
    forceMount?: true;
}
declare const CollapsibleContent: React.ForwardRefExoticComponent<CollapsibleContentProps & React.RefAttributes<HTMLDivElement>>;
interface CollapsibleContentImplProps extends PrimitiveDivProps {
    present: boolean;
}
declare const Root: React.ForwardRefExoticComponent<CollapsibleProps & React.RefAttributes<HTMLDivElement>>;
declare const Trigger: React.ForwardRefExoticComponent<CollapsibleTriggerProps & React.RefAttributes<HTMLButtonElement>>;
declare const Content: React.ForwardRefExoticComponent<CollapsibleContentProps & React.RefAttributes<HTMLDivElement>>;

export { Collapsible, CollapsibleContent, type CollapsibleContentProps, type CollapsibleProps, CollapsibleTrigger, type CollapsibleTriggerProps, Content, Root, Trigger, createCollapsibleScope };
