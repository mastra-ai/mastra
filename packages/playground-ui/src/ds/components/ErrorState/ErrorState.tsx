import { CircleXIcon } from 'lucide-react';

export type ErrorStateProps = {
  title: string;
  message: string;
  action?: React.ReactNode;
};

export function ErrorState({ title, message, action }: ErrorStateProps) {
  return (
    <div className="flex h-[30vh] items-center justify-center">
      <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
        <div className="mb-4">
          <CircleXIcon className="size-8 text-red-900" />
        </div>
        <h3 className="text-ui-md text-neutral4 font-medium">{title}</h3>
        <p className="text-ui-md text-neutral2 mt-1.5 max-w-md">{message}</p>
        {action && <div className="flex items-center justify-center pt-4">{action}</div>}
      </div>
    </div>
  );
}
