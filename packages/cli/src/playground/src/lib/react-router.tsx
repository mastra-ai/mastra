import { useMemo } from 'react';
import { Navigate, NavigateOptions, useParams } from 'react-router';

export interface NavigateToProps {
  to: string;
  options?: NavigateOptions;
}

export const NavigateTo = ({ to, options }: NavigateToProps) => {
  const params = useParams();

  const newUrl = useMemo(() => {
    const extractedRouteParams = extractRouteParams(to);
    let newUrl = to;

    for (const param of extractedRouteParams) {
      newUrl = newUrl.replace(`:${param}`, params[param] as string);
    }

    return newUrl;
  }, [to, params]);

  return <Navigate to={newUrl} {...options} />;
};

function extractRouteParams(path: string): string[] {
  const params: string[] = [];
  const segments = path.split('/');

  for (const segment of segments) {
    if (segment.startsWith(':')) {
      params.push(segment.slice(1)); // Remove the ':' prefix
    }
  }

  return params;
}
