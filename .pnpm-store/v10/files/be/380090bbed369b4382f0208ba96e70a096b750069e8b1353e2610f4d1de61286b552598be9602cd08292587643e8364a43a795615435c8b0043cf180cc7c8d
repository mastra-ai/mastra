import { withScroll, offset as offsetBox } from 'css-box-model';
import type { Position, BoxModel } from 'css-box-model';
import type { DraggableDimension } from '../../types';

interface Args {
  draggable: DraggableDimension;
  offset: Position;
  initialWindowScroll: Position;
}

export default ({
  draggable,
  offset,
  initialWindowScroll,
}: Args): DraggableDimension => {
  const client: BoxModel = offsetBox(draggable.client, offset);
  const page: BoxModel = withScroll(client, initialWindowScroll);

  const moved: DraggableDimension = {
    ...draggable,
    placeholder: {
      ...draggable.placeholder,
      client,
    },
    client,
    page,
  };

  return moved;
};
