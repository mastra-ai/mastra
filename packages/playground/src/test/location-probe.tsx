import { useLocation } from 'react-router';

/** Shows the router's search params in `data-testid="location"`, to assert what the URL holds. */
export function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.search}</div>;
}
