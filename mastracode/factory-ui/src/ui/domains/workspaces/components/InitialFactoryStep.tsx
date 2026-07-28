import { Button } from '@mastra/playground-ui/components/Button';

export interface InitialFactoryStepProps {
  onContinue: () => void;
}

export function InitialFactoryStep({ onContinue }: InitialFactoryStepProps) {
  return (
    <>
      <div className="w-full max-w-2xl text-left" aria-hidden="true">
        <div className="grid grid-cols-3 gap-3">
          <div className="border-border1 bg-surface2/80 rounded-xl border p-3">
            <div className="text-ui-xs text-icon3 mb-3 flex items-center gap-2 font-medium">
              <span className="bg-icon2 size-2 rounded-full" />
              To do
            </div>
            <div className="relative min-h-[140px]">
              <div className="animate-factory-ticket-move border-border1 bg-surface3 absolute inset-x-0 top-0 z-10 h-[64px] rounded-lg border px-3 py-2.5 shadow-sm motion-reduce:animate-none">
                <span className="text-ui-xs text-icon3 block">ENG-124</span>
                <span className="text-ui-sm text-icon6 mt-1 block font-medium">Add repository search</span>
              </div>
              <div className="animate-factory-ticket-appear border-border1 bg-surface3 absolute inset-x-0 top-[76px] h-[64px] rounded-lg border px-3 py-2.5 shadow-sm motion-reduce:animate-none">
                <span className="text-ui-xs text-icon3 block">ENG-125</span>
                <span className="text-ui-sm text-icon6 mt-1 block font-medium">Improve setup flow</span>
              </div>
            </div>
          </div>
          <div className="border-border1 bg-surface2/80 rounded-xl border p-3">
            <div className="text-ui-xs text-icon3 mb-3 flex items-center gap-2 font-medium">
              <span className="bg-accent1 size-2 rounded-full" />
              In progress
            </div>
            <div className="min-h-[140px]" />
          </div>
          <div className="border-border1 bg-surface2/80 rounded-xl border p-3">
            <div className="text-ui-xs text-icon3 mb-3 flex items-center gap-2 font-medium">
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
