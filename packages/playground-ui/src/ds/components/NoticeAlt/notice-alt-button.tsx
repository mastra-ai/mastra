import type { ButtonProps } from '../Button';
import { Button } from '../Button';

export function NoticeAltButton(props: ButtonProps) {
  return <Button size="sm" variant="outline" {...props} />;
}
