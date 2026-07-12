import { Check, Pencil, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

export function ProposalTag({
  tag,
  onRename,
  onRemove,
}: {
  tag: string;
  onRename: (newTag: string) => void;
  onRemove: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(tag);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleConfirm = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== tag) {
      onRename(trimmed);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-md border border-border1 bg-surface3 px-1">
        <input
          ref={inputRef}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleConfirm();
            }
            if (e.key === 'Escape') {
              setEditValue(tag);
              setIsEditing(false);
            }
          }}
          onBlur={handleConfirm}
          className="w-20 bg-transparent py-0.5 text-xs text-neutral4 outline-hidden"
        />
        <button
          type="button"
          onMouseDown={e => {
            e.preventDefault();
            handleConfirm();
          }}
          className="hover:text-positive2 p-0.5 text-positive1"
        >
          <Check className="size-3" />
        </button>
      </span>
    );
  }

  return (
    <span className="group inline-flex items-center gap-0.5 rounded-md border border-border1 bg-surface3 px-1.5 py-0.5 text-xs text-neutral4">
      {tag}
      <button
        type="button"
        onClick={() => {
          setEditValue(tag);
          setIsEditing(true);
        }}
        className="p-0.5 text-neutral2 opacity-0 transition-opacity group-hover:opacity-100 hover:text-neutral4"
        title="Edit tag"
      >
        <Pencil className="size-3" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="p-0.5 text-neutral2 opacity-0 transition-opacity group-hover:opacity-100 hover:text-negative1"
        title="Remove tag"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
