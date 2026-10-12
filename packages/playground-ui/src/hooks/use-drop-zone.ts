import type { DragEvent } from 'react';
import { useState } from 'react';

export interface UseDropZoneOptions {
  /** `DataTransfer` type the zone takes, e.g. `Files` or a custom MIME. Drags without it pass through untouched. */
  accept: string;
  dropEffect?: DataTransfer['dropEffect'];
  onDrop: (dataTransfer: DataTransfer) => void;
}

export function useDropZone({ accept, dropEffect, onDrop }: UseDropZoneOptions) {
  const [isDragOver, setIsDragOver] = useState(false);

  return {
    isDragOver,
    dropZoneProps: {
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (!event.dataTransfer.types.includes(accept)) return;
        event.preventDefault();
        if (dropEffect) event.dataTransfer.dropEffect = dropEffect;
        setIsDragOver(true);
      },
      onDragLeave: (event: DragEvent<HTMLElement>) => {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
        setIsDragOver(false);
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        if (!event.dataTransfer.types.includes(accept)) return;
        event.preventDefault();
        setIsDragOver(false);
        onDrop(event.dataTransfer);
      },
    },
  };
}
