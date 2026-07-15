import { Composer } from './Composer';

const composerPanelClass = 'w-full shrink-0';

type ComposerPanelProps = {
  composerVariant?: 'inline' | 'textarea';
};

export function ComposerPanel({ composerVariant = 'inline' }: ComposerPanelProps) {
  return (
    <div className={composerPanelClass}>
      <Composer variant={composerVariant} />
    </div>
  );
}
