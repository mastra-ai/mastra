import type { ComposerTone } from '@mastra/playground-ui/components/Composer';

export function getComposerTone(modeId: string | undefined): ComposerTone {
  switch (modeId?.toLowerCase()) {
    case undefined:
    case 'build':
      return 'green';
    case 'plan':
      return 'purple';
    case 'fast':
      return 'orange';
    default:
      return 'default';
  }
}
