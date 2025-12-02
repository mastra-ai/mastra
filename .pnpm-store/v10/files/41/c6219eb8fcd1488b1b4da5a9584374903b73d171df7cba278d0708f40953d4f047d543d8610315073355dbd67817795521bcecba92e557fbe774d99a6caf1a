import { ComponentRef, ComponentPropsWithoutRef, MouseEventHandler } from "react";
import { Primitive } from "@radix-ui/react-primitive";
type ActionButtonCallback<TProps> = (props: TProps) => MouseEventHandler<HTMLButtonElement> | null;
type PrimitiveButtonProps = ComponentPropsWithoutRef<typeof Primitive.button>;
export type ActionButtonProps<THook> = PrimitiveButtonProps & (THook extends (props: infer TProps) => unknown ? TProps : never);
export type ActionButtonElement = ComponentRef<typeof Primitive.button>;
export declare const createActionButton: <TProps>(displayName: string, useActionButton: ActionButtonCallback<TProps>, forwardProps?: (keyof NonNullable<TProps>)[]) => import("react").ForwardRefExoticComponent<import("react").PropsWithoutRef<Omit<import("react").ClassAttributes<HTMLButtonElement> & import("react").ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean;
}, "ref"> & TProps> & import("react").RefAttributes<HTMLButtonElement>>;
export {};
//# sourceMappingURL=createActionButton.d.ts.map