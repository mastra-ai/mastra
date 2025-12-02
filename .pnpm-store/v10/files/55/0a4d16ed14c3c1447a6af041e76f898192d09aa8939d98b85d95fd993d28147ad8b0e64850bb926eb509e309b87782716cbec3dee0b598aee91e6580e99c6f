/**
 * @poppinss/colors
 *
 * (c) Poppinss
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { Colors } from './base.js';
import { type ColorTransformations } from './types.js';
/**
 * Concrete implementation of the Colors class that prefixes the
 * applied transformations to the final text as string.
 *
 * This class is meant to be used at the time of testing
 */
export declare class Raw extends Colors {
    #private;
    /**
     * Perform the given transformation. The base class will
     * invoke this method
     */
    protected transform(transformation: ColorTransformations): this;
    protected transform(transformation: ColorTransformations, text: string | number): string;
}
