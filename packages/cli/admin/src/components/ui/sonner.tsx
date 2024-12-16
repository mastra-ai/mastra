'use client';

import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      // the lengthy classname just means, target all children with the data-attr and translate them 150% in the y-axis.
      className="toaster group [&>[data-removed=true]]:!translate-y-[150%] [&>[data-removed=true]]:before:!translate-y-[150%] [&>[data-removed=true]]:after:!translate-y-[150%]"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-neutral-790 group-[.toaster]:text-white group-[.toaster]:border-neutral-775 group[.toaster]:border group-[.toaster]:shadow-lg flex justify-between',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-neutral-775 group-[.toast]:text-white',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
