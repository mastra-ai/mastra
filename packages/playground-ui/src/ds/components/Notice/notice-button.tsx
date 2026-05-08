import type { ButtonProps } from '../Button';
import { Button } from '../Button';

export function NoticeButton(props: ButtonProps) {
  return <Button size="sm" variant="ghost" {...props} />;
}
