/**
 * Getting Bun Server Object for Bun adapters
 * @module
 */
import type { Context } from '../../context';
/**
 * Bun Server Object
 */
export interface BunServer {
    requestIP?: (req: Request) => {
        address: string;
        family: string;
        port: number;
    };
    upgrade<T>(req: Request, options?: {
        data: T;
    }): boolean;
}
/**
 * Get Bun Server Object from Context
 * @param c Context
 * @returns Bun Server
 */
export declare const getBunServer: (c: Context) => BunServer | undefined;
