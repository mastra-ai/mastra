import { spawn } from "cross-spawn";
async function spawnLocal(executable, args, options) {
    const child = spawn(executable, [
        ...args
    ], {
        stdio: options.stdio ?? 'inherit',
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
