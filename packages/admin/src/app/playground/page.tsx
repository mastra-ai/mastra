import Link from 'next/link';

import { Icon } from '../components/icon';

function Playground() {
  //we need an api that shows all connected integration
  return (
    <section>
      <h1 className="text-sm gradient capitalize border-b-[0.5px] py-2 border-primary-border p-4">Playground</h1>
      <div className="p-4 flex flex-col gap-4 mx-auto max-w-[40em]">
        <div className="">
          <h1 className="text-xl">Connected Integrations</h1>
          <p className="text-sm text-arkw-el-3">Explore events and apis for connected integrations</p>
        </div>
        <div className="grid grid-cols-4 max-w-72 gap-x-5 gap-3">
          <Link
            href={'#'}
            className="rounded bg-arkw-bg-4 h-16 w-16 hover:translate-x-0.5 transition-all grid place-items-center hover:shadow-sm"
          >
            <Icon name="google" className="w-8 h-8" />
          </Link>
          <Link
            href={'#'}
            className="rounded bg-arkw-bg-4 group h-16 w-16 hover:translate-x-0.5 transition-all grid place-items-center hover:shadow-sm"
          >
            <Icon
              name="mailchimp"
              className="w-8 h-8  transition-all group-hover:text-[color:var(--mailchimp-color)]"
            />
          </Link>
          <Link
            href={'#'}
            className="rounded bg-arkw-bg-4 group h-16 w-16 hover:translate-x-0.5 transition-all grid place-items-center hover:shadow-sm"
          >
            <Icon name="rewatch" className="w-8 h-8 transition-all group-hover:text-[color:var(--rewatch-color)]" />
          </Link>

          <Link
            href={'#'}
            className="rounded group bg-arkw-bg-4 h-16 w-16 hover:translate-x-0.5 transition-all grid place-items-center hover:shadow-sm"
          >
            <Icon name="asana" className="w-8 h-8 transition-colors group-hover:text-[color:var(--asana-color)]" />
          </Link>

          <Link
            href={'#'}
            className="rounded group bg-arkw-bg-4 h-16 w-16 hover:translate-x-0.5 transition-all grid place-items-center hover:shadow-sm"
          >
            <Icon name="twitter" className="w-8 h-8 transition-colors]" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export default Playground;
