import type { OutgoingFile } from '../../services/transcript';

export interface PendingImage extends OutgoingFile {
  id: string;
}
