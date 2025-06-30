import { Button } from '@/components/ui/button';
import { InfoIcon } from '@/ds/icons';

type PanelSectionProps = {
  title?: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  href?: string;
  action?: {
    onAction: () => void;
    label: string;
    icon: React.ReactNode;
  };
};

export function PanelSection({ children, title, href, action }: PanelSectionProps) {
  return (
    <div className="grid gap-[10px]">
      <div className="flex items-center gap-2">
        <h3 className="text-[12px] text-icon3">{title}</h3>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="[&>svg]:text-icon3 [&>svg]:w-[12px] [&>svg]:h-[12px]"
          >
            <InfoIcon />
          </a>
        )}
        {action && (
          <Button onClick={action.onAction} className="ml-auto" variant={'ghost'} size="icon">
            {action.icon}
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}
