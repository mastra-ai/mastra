import { NoticeAltButton } from './notice-alt-button';
import { NoticeAltMessage } from './notice-alt-message';
import { NoticeAltRoot, type NoticeAltRootProps } from './notice-alt-root';

export { type NoticeAltMessageProps } from './notice-alt-message';
export { type NoticeAltRootProps, type NoticeAltSurface, type NoticeAltVariant } from './notice-alt-root';

export function NoticeAlt(props: NoticeAltRootProps) {
  return <NoticeAltRoot {...props} />;
}

NoticeAlt.Message = NoticeAltMessage;
NoticeAlt.Button = NoticeAltButton;
