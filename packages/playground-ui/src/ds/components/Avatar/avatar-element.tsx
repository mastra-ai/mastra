import { AvatarNamed } from './avatar-named';
import type { AvatarProps } from './avatar-named';
import { AvatarRoot } from './avatar-root';
import type { AvatarRootProps } from './avatar-root';

export function AvatarElement(props: AvatarProps | AvatarRootProps) {
  if (props.name === undefined) return <AvatarRoot {...props} />;
  return <AvatarNamed {...props} />;
}
