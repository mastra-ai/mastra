"use client";

import { X } from "lucide-react";
import { toast as sonnerToast } from "sonner";

export function toast(toast: Omit<ToastProps, "id">) {
  return sonnerToast.custom((id) => (
    <Toast id={id} title={toast.title} description={toast.description} />
  ));
}

function Toast(props: ToastProps) {
  const { title, description, id } = props;

  return (
    <div className="flex rounded-md justify-between ring-1 ring-black/5 dark:ring-borders-2 w-full md:max-w-[364px] items-start p-4">
      <div className="flex items-center rounded-md">
        <div className="w-full">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {title}
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-white  ">
            {description}
          </p>
        </div>
      </div>
      <div>
        <button
          type="button"
          className="bg-[var(--color-green-accent-2)]/15 focus:outline-0 focus:ring-accent-green focus:ring-1 dark:bg-transparent text-black dark:text-white  size-5 grid place-items-center text-sm rounded-full"
          onClick={() => {
            sonnerToast.dismiss(id);
          }}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

interface ToastProps {
  id: string | number;
  title: string;
  description: string;
}
