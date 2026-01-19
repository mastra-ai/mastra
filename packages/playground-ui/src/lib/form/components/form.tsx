import React from 'react';

export const Form = React.forwardRef<HTMLFormElement, React.ComponentProps<'form'>>(({ children, ...props }, ref) => {
  return (
    <form ref={ref} className="space-y-4" {...props}>
      {children}
    </form>
  );
});
