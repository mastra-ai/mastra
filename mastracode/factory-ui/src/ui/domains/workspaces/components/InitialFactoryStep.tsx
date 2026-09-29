import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

export interface InitialFactoryStepProps {
  onContinue: () => void;
}

export function InitialFactoryStep({ onContinue }: InitialFactoryStepProps) {
  return (
    <>
      <div className="w-full max-w-2xl text-left" aria-hidden="true">
        <div className="grid grid-cols-3 gap-3">
          <div className="border-border bg-background/80 rounded-xl border p-3">
            <div className="text-meta text-muted-foreground mb-3 flex items-center gap-2">
              <span className="bg-placeholder size-2 rounded-full" />
              To do
            </div>
            <div className="relative min-h-[140px]">
              <div className="animate-factory-ticket-move bg-card shadow-raised absolute inset-x-0 top-0 z-10 h-[64px] rounded-lg px-3 py-2.5 motion-reduce:animate-none">
                <Txt as="span" variant="meta" tone="muted" className="block">
                  ENG-124
                </Txt>
                <Txt as="span" variant="column" tone="ink" className="mt-1 block">
                  Add repository search
                </Txt>
              </div>
              <div className="animate-factory-ticket-appear bg-card shadow-raised absolute inset-x-0 top-[76px] h-[64px] rounded-lg px-3 py-2.5 motion-reduce:animate-none">
                <Txt as="span" variant="meta" tone="muted" className="block">
                  ENG-125
                </Txt>
                <Txt as="span" variant="column" tone="ink" className="mt-1 block">
                  Improve setup flow
                </Txt>
              </div>
            </div>
          </div>
          <div className="border-border bg-background/80 rounded-xl border p-3">
            <div className="text-meta text-muted-foreground mb-3 flex items-center gap-2">
              <span className="bg-accent1 size-2 rounded-full" />
              In progress
            </div>
            <div className="min-h-[140px]" />
          </div>
          <div className="border-border bg-background/80 rounded-xl border p-3">
            <div className="text-meta text-muted-foreground mb-3 flex items-center gap-2">
              <span className="bg-accent3 size-2 rounded-full" />
              Deployed
            </div>
            <div className="min-h-[140px]" />
          </div>
        </div>
      </div>

      <Button variant="primary" size="lg" className="mt-8 min-h-14 text-base" onClick={onContinue}>
        Create my first factory
      </Button>
    </>
  );
}
