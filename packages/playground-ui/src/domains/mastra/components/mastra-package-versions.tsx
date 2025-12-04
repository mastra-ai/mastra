import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Badge, useMastraPackageVersions } from '@/index';
import { cn } from '@/lib/utils';
import { Fragment, useState } from 'react';

export function MastraPackageVersions() {
  const { data } = useMastraPackageVersions();
  const { packages, outdated, version, deprecated } = data || {};
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <div className="w-full px-3 mb-2 ">
        <button
          onClick={() => setIsDialogOpen(true)}
          className="flex justify-between text-[0.75rem] text-icon3 w-full rounded-lg text-left items-baseline"
        >
          <span>{`core v. ${version}`}</span>
          {outdated + deprecated === 0 && <span className="flex items-center gap-1 opacity-70">All up to date</span>}

          {(outdated > 0 || deprecated > 0) && (
            <span className="flex items-baseline gap-1">
              <span
                className={cn(
                  'inline-flex font-bold bg-orange-900 rounded-md px-1 items-center justify-center text-icon4 text-[0.75rem]',
                  {
                    'bg-red-700': deprecated > 0,
                  },
                )}
              >
                {deprecated ? deprecated : outdated}
              </span>{' '}
              {deprecated ? 'deprecated' : 'outdated'}
            </span>
          )}
        </button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogTitle>Mastra packages in use:</DialogTitle>
          <div
            className={cn(
              'text-[0.875rem] text-icon3 grid grid-cols-[1fr_auto_auto] mb-2 items-center gap-x-4 gap-y-2',
              '[&>b]:bg-green-900 [&>b]:rounded-lg [&>b]:px-2',
            )}
          >
            {packages.map(pkg => (
              <Fragment key={pkg.name}>
                <span>{pkg.name}</span>
                <em>{pkg.used}</em>
                {pkg.used === pkg.latest ? (
                  <Badge variant="success">Latest</Badge>
                ) : pkg.usedDeprecated ? (
                  <Badge variant="error">Deprecated</Badge>
                ) : (
                  <Badge variant="warning">Outdated</Badge>
                )}
              </Fragment>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
