import { useParams } from 'react-router';

export function SignalsEntityCrumb() {
  const { entityId } = useParams();
  return entityId ? <span>{entityId}</span> : null;
}
