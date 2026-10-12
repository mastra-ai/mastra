import { AvatarNamed, type AvatarProps } from './avatar-named';
import { AvatarRoot, type AvatarRootProps } from './avatar-root';

export function AvatarElement(props: AvatarProps | AvatarRootProps) {
  if (props.name === undefined) return <AvatarRoot {...props} />;
  return <AvatarNamed {...props} />;
}
