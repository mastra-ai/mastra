import { NoticeButton } from './notice-button';
import { NoticeColumn } from './notice-column';
import { NoticeMessage } from './notice-message';
import { NoticeRoot } from './notice-root';
import { NoticeTitle } from './notice-title';

export { type NoticeVariant, type NoticeRootProps } from './notice-root';
export { type NoticeMessageProps } from './notice-message';

export const Notice = Object.assign(NoticeRoot, {
  Message: NoticeMessage,
  Button: NoticeButton,
  Title: NoticeTitle,
  Column: NoticeColumn,
});
