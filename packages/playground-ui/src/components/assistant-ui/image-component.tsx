import { ImageContentPartComponent } from '@assistant-ui/react';
import { Skeleton } from '../ui/skeleton';

export const ImageComponent: ImageContentPartComponent = ({ image, status }) => {
  if (status.type === 'complete') return <img src={image} alt="test" height={250} width={250} />;
  return <Skeleton className="h-[250px] w-[250px]" />;
};
