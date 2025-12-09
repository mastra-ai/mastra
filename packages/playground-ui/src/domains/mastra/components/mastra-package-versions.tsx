import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useMastraPackageVersions } from '@/index';
import { SelectField } from '@/components/ui/elements/form-fields/select-field';

import { cn } from '@/lib/utils';
import { CopyIcon, InfoIcon, MoveRightIcon } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Button } from '@/components/ui/elements/buttons';
import { ButtonsGroup } from '@/components/ui/containers';

export function MastraPackageVersions() {
  const { data } = useMastraPackageVersions();
  const { allPackages, outdatedPackagesCount, version, deprecatedPackagesCount } = data || {};
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [commandStr, setCommandStr] = useState('pnpm add');

  const commandParams = allPackages.map(pkg => (pkg.used !== pkg.latest ? `${pkg.name}@${pkg.latest} ` : '')).join('');

  const { handleCopy } = useCopyToClipboard({
    text: `${commandStr} ${commandParams}`,
    copyMessage: 'Command copied to clipboard',
  });

  return (
    <>
      <div className="w-full px-3 mb-2 ">
        <button
          onClick={() => setIsDialogOpen(true)}
          className={cn(
            'flex justify-between text-[0.75rem] text-icon3 w-full rounded-lg text-left items-baseline cursor-help',
            '[&_.tiny-badge]:opacity-75 [&:hover_.tiny-badge]:opacity-100',
          )}
        >
          <span>{`core v. ${version}`}</span>
          {outdatedPackagesCount + deprecatedPackagesCount === 0 && (
            <span className="flex items-center gap-1 opacity-70">All up to date</span>
          )}

          {(outdatedPackagesCount > 0 || deprecatedPackagesCount > 0) && (
            <span className="info flex items-baseline gap-1">
              <TinyBadge
                value={
                  deprecatedPackagesCount > 0 ? deprecatedPackagesCount.toString() : outdatedPackagesCount.toString()
                }
                isDeprecated={deprecatedPackagesCount > 0}
              />

              {deprecatedPackagesCount > 0 ? 'deprecated' : 'outdated'}
            </span>
          )}
        </button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[50rem] bg-surface1">
          <DialogTitle>
            @mastra/ <span className="text-icon3 font-normal">packages in use</span>
          </DialogTitle>
          <div className={cn('text-[0.875rem] text-icon3 items-center gap-x-4 ')}>
            <div className="py-4">
              {!outdatedPackagesCount && !deprecatedPackagesCount && 'All packages are up to date!'}
              {outdatedPackagesCount ? (
                <>
                  <TinyBadge value={outdatedPackagesCount.toString()} />{' '}
                  {`package${outdatedPackagesCount === 1 ? '' : 's'} outdated`}
                </>
              ) : (
                ''
              )}{' '}
              {deprecatedPackagesCount ? (
                <>
                  <TinyBadge value={deprecatedPackagesCount.toString()} isDeprecated={true} />{' '}
                  {`package${deprecatedPackagesCount === 1 ? '' : 's'} deprecated`}
                </>
              ) : (
                ''
              )}
            </div>
            {allPackages.length > 0 && (
              <>
                <div
                  className={cn(
                    'grid grid-cols-[1fr_auto_auto] items-center mb-2 w-full',
                    '[&>div]:py-1 [&>div]:border-t [&>div]:border-border1 [&>div]:flex [&>div]:items-center',
                  )}
                >
                  {allPackages.map(pkg => (
                    <Fragment key={pkg.name}>
                      <div>{pkg.name}</div>
                      <div>
                        {pkg.used !== pkg.latest ? (
                          <TinyBadge value={pkg.used} isDeprecated={pkg.usedDeprecated} />
                        ) : (
                          pkg.used
                        )}
                      </div>
                      <div>
                        {pkg.used !== pkg.latest ? (
                          <>
                            <MoveRightIcon className="w-4 h-4 mx-3" />
                            {pkg.latest}
                          </>
                        ) : (
                          '\u00A0'
                        )}
                      </div>
                    </Fragment>
                  ))}
                </div>
              </>
            )}
          </div>

          {(outdatedPackagesCount > 0 || deprecatedPackagesCount > 0) && (
            <>
              <div
                className={cn(
                  'text-[0.875rem] text-icon3 grid grid-cols-[auto_1fr] gap-2 ',
                  '[&>svg]:w-[1.5em] [&>svg]:h-[1.5em] [&>svg]:translate-y-1',
                )}
              >
                <InfoIcon /> Use the below command to update your @mastra packages to the latest versions
              </div>

              <pre className="text-[0.875rem] text-icon3 bg-surface2 rounded-md p-3 overflow-x-auto block w-full whitespace-break-spaces text-left">{`${commandStr} ${commandParams}`}</pre>

              <ButtonsGroup>
                <SelectField
                  options={[
                    { label: 'pnpm', value: 'pnpm add' },
                    { label: 'npm', value: 'npm install' },
                    { label: 'yarn', value: 'yarn add' },
                    { label: 'bun', value: 'bun add' },
                  ]}
                  onValueChange={value => setCommandStr(value)}
                  value={commandStr}
                />

                <Button onClick={handleCopy}>
                  Copy to clipboard <CopyIcon />
                </Button>
              </ButtonsGroup>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function TinyBadge({ value, isDeprecated = false }: { value: string; isDeprecated?: boolean }) {
  return (
    <span
      className={cn(
        'tiny-badge inline-flex font-bold bg-yellow-700 rounded-md px-1 items-center justify-center text-black text-[0.75rem] min-w-[1rem]',
        {
          'bg-red-700': isDeprecated,
        },
      )}
    >
      {value}
    </span>
  );
}
