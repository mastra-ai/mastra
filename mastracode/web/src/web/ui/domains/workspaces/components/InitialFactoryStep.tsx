import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

export interface InitialFactoryStepProps {
  onContinue: () => void;
}

export function InitialFactoryStep({ onContinue }: InitialFactoryStepProps) {
  return (
    <>
      <h1 className="mx-auto max-w-2xl text-3xl leading-tight font-semibold tracking-[-0.035em] text-balance sm:text-4xl lg:text-5xl">
        Build software with a Factory that knows your work.
      </h1>
      <Txt as="p" variant="ui-lg" className="mx-auto mt-6 max-w-2xl leading-7 text-neutral3 sm:text-lg">
        A Software Factory connects your code, project context, and coding sessions in one shared workspace. It keeps every
        agent grounded in the repository and work that matter to your team.
      </Txt>

      <div className="mx-auto mt-8 w-full max-w-2xl text-left" aria-hidden="true">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border1 bg-surface2/80 p-3">
            <div className="mb-3 flex items-center gap-2 text-ui-xs font-medium text-icon3">
              <span className="size-2 rounded-full bg-icon2" />
              To do
            </div>
            <div className="relative min-h-[140px]">
              <div className="animate-factory-ticket-move absolute inset-x-0 top-0 z-10 h-[64px] rounded-lg border border-border1 bg-surface3 px-3 py-2.5 shadow-sm motion-reduce:animate-none">
                <span className="block text-ui-xs text-icon3">ENG-124</span>
                <span className="mt-1 block text-ui-sm font-medium text-icon6">Add repository search</span>
              </div>
              <div className="animate-factory-ticket-appear absolute inset-x-0 top-[76px] h-[64px] rounded-lg border border-border1 bg-surface3 px-3 py-2.5 shadow-sm motion-reduce:animate-none">
                <span className="block text-ui-xs text-icon3">ENG-125</span>
                <span className="mt-1 block text-ui-sm font-medium text-icon6">Improve setup flow</span>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border1 bg-surface2/80 p-3">
            <div className="mb-3 flex items-center gap-2 text-ui-xs font-medium text-icon3">
              <span className="size-2 rounded-full bg-accent1" />
              In progress
            </div>
            <div className="min-h-[140px]" />
          </div>
          <div className="rounded-xl border border-border1 bg-surface2/80 p-3">
            <div className="mb-3 flex items-center gap-2 text-ui-xs font-medium text-icon3">
              <span className="size-2 rounded-full bg-accent3" />
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
