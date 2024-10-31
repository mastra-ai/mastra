import { IconName } from '@/types/icons';

export interface BubbleMenuItem {
  name: string;
  isActive?: () => boolean;
  command: () => void;
  icon: IconName;
}
