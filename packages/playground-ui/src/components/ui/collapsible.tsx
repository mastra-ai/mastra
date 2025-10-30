import { cn } from '@/lib/utils';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = (props: CollapsiblePrimitive.CollapsibleTriggerProps) => {
  const { className, ...rest } = props;
  return <CollapsiblePrimitive.CollapsibleTrigger className={cn('-outline-offset-2', className)} {...rest} />;
};

const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
