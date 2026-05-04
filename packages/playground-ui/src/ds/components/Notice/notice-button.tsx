import type { ButtonProps } from '../Button';
import { Button } from '../Button';

export function NoticeButton(props: ButtonProps) {
  return (
    <div className="self-start">
      <Button size="sm" variant="ghost" {...props} />
    </div>
  );
}
