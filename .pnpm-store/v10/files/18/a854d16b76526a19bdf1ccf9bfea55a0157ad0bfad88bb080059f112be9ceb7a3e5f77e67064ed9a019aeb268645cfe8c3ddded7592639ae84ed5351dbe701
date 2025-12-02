import { spawn } from "node:child_process";
import { resolveBinaryPath } from "./utils.mjs";
async function spawnLocal(binaryName, args, options) {
    let binaryLocation;
    try {
        binaryLocation = resolveBinaryPath(options.env.PATH ?? '', options.resolveFrom, binaryName);
        options.onBinaryFound(binaryLocation);
    } catch (e) {
        console.error(e);
        throw new Error(`Binary ${binaryName} not found. Make sure postinstall script was allowed if it installs the binary`);
    }
    const child = spawn(binaryLocation, [
        ...args
    ], {
        shell: true,
        stdio: options?.stdio ?? 'inherit',
        env: options.env,
        cwd: options.cwd
    });
    await new Promise((resolve, reject)=>{
        child.on('close', (code)=>{
            if (0 === code) resolve();
            else reject(new Error(`Command failed with code ${code}`));
        });
        child.on('error', (error)=>{
            reject(error);
        });
    });
}
export { spawnLocal };
