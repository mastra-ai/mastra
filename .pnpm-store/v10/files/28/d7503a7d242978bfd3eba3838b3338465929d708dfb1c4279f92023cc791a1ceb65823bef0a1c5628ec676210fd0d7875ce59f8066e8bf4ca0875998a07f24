import { type HTMLAttributes } from 'react';
import { type HandleProps as HandlePropsSystem, OnConnect } from '@xyflow/system';
/**
 * @expand
 */
export type HandleProps = HandlePropsSystem & Omit<HTMLAttributes<HTMLDivElement>, 'id'> & {
    /** Callback called when connection is made */
    onConnect?: OnConnect;
};
/**
 * The `<Handle />` component is used in your [custom nodes](/learn/customization/custom-nodes)
 * to define connection points.
 *
 *@public
 *
 *@example
 *
 *```jsx
 *import { Handle, Position } from '@xyflow/react';
 *
 *export function CustomNode({ data }) {
 *  return (
 *    <>
 *      <div style={{ padding: '10px 20px' }}>
 *        {data.label}
 *      </div>
 *
 *      <Handle type="target" position={Position.Left} />
 *      <Handle type="source" position={Position.Right} />
 *    </>
 *  );
 *};
 *```
 */
export declare const Handle: import("react").MemoExoticComponent<(props: HandlePropsSystem & Omit<HTMLAttributes<HTMLDivElement>, "id"> & {
    /** Callback called when connection is made */
    onConnect?: OnConnect;
} & import("react").RefAttributes<HTMLDivElement>) => import("react").JSX.Element>;
//# sourceMappingURL=index.d.ts.map