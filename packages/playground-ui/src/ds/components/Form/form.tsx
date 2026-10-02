import { Form as FormPrimitive } from '@base-ui/react/form';

import { cn } from '@/lib/utils';

type FormProps = Omit<FormPrimitive.Props, 'className'> & {
  className?: string;
};

function Form({ className, ...props }: FormProps) {
  return <FormPrimitive data-slot="form" className={cn('flex flex-col gap-4', className)} {...props} />;
}

export { Form };
export type { FormProps };
