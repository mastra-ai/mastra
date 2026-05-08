import { CircleXIcon } from 'lucide-react';

export type ErrorStateProps = {
  title: string;
  message: string;
};

export function ErrorState({ title, message }: ErrorStateProps) {
  return (
    <div className="flex items-center justify-center h-[30vh]">
      <div className="flex flex-col items-center justify-center text-center py-10 px-6">
        <div className="mb-4">
          <CircleXIcon className="h-8 w-8 text-red-900" />
        </div>
        <h3 className="font-medium text-neutral4 text-ui-md">{title}</h3>
        <p className="mt-1.5 text-neutral2 text-ui-md max-w-md">{message}</p>
      </div>
    </div>
  );
}
