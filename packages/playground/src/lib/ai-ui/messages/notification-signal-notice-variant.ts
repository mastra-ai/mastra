import type { NoticeVariant } from '@mastra/playground-ui/components/Notice';

export const getNotificationNoticeVariant = (priority: string | undefined): NoticeVariant => {
  switch (priority) {
    case 'urgent':
      return 'destructive';
    case 'high':
      return 'warning';
    case 'medium':
      return 'info';
    default:
      return 'note';
  }
};
