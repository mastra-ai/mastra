import type { ReactNode } from 'react';
import { MemoryRouter, useSearchParams } from 'react-router';
import type { SetURLSearchParamsLike } from '@/lib/sort/use-url-sort';

type UrlState = { searchParams: URLSearchParams; setSearchParams: SetURLSearchParamsLike };

function Params({ children }: { children: (url: UrlState) => ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  return (
    <>
      {children({ searchParams, setSearchParams })}
      <output data-testid="search-params">{searchParams.toString()}</output>
    </>
  );
}

/**
 * A react-router host whose URL starts at `?initial`. Hands its search params to `children` and prints
 * the current query string in `data-testid="search-params"` so a test can read what was written.
 */
export function SearchParamsHost({ initial, children }: { initial: string; children: (url: UrlState) => ReactNode }) {
  return (
    <MemoryRouter initialEntries={[`/?${initial}`]}>
      <Params>{children}</Params>
    </MemoryRouter>
  );
}
