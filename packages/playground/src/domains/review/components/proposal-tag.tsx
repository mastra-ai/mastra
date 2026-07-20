import { Pencil, Check, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

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
      <span className="bg-surface3 border-border1 inline-flex items-center gap-0.5 rounded-md border px-1">
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
          className="text-neutral4 w-20 bg-transparent py-0.5 text-xs outline-hidden"
        />
        <button
          type="button"
          onMouseDown={e => {
            e.preventDefault();
            handleConfirm();
          }}
          className="text-positive1 hover:text-positive2 p-0.5"
        >
          <Check className="h-3 w-3" />
        </button>
      </span>
    );
  }

  return (
    <span className="bg-surface3 border-border1 text-neutral4 group inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-xs">
      {tag}
      <button
        type="button"
        onClick={() => {
          setEditValue(tag);
          setIsEditing(true);
        }}
        className="text-neutral2 hover:text-neutral4 p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
        title="Edit tag"
      >
        <Pencil className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="text-neutral2 hover:text-negative1 p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
        title="Remove tag"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
