/**
 * Stand-in for `@uiw/react-codemirror`: a textarea named "Code editor" that tests drive with `fireEvent.change`.
 *
 * Usage: `vi.mock('@uiw/react-codemirror', () => import('@/test/mock-code-editor'));`
 */
export default function MockCodeEditor({
  value,
  onChange,
  editable,
}: {
  value: string;
  onChange?: (value: string) => void;
  editable?: boolean;
}) {
  return (
    <textarea
      aria-label="Code editor"
      value={value}
      onChange={event => onChange?.(event.target.value)}
      readOnly={editable === false}
    />
  );
}
