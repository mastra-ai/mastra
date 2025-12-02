'use strict';

const { spawn } = require('child_process');

/**
 * @param {Array<string>} [args]
 * @returns {Promise<{exitCode: number | null, stdout: string, stderr: string}>}
 */
async function runClang(args = []) {
    try {
        const { exitCode, stdout, stderr } = await new Promise((resolve, reject) => {
            const spawned = spawn('clang',
                ['-Xclang', ...args]
            );

            let stdout = '';
            let stderr = '';

            spawned.stdout?.on('data', (data) => {
                stdout += data.toString('utf-8');
            });
            spawned.stderr?.on('data', (data) => {
                stderr += data.toString('utf-8');
            });

            spawned.on('exit', function (exitCode) {
                resolve({ exitCode, stdout, stderr });
            });

            spawned.on('error', function (err) {
                reject(err);
            });
        });

        if (exitCode !== 0) {
            throw new Error(`clang exited with non-zero exit code ${exitCode}. stderr: ${stderr ? stderr : '<empty>'}`);
        }

        return { exitCode, stdout, stderr };
    } catch (err) {
        if (err.code === 'ENOENT') {
            throw new Error('This tool requires clang to be installed.');
        }
        throw err;
    }
}

module.exports = {
    runClang
};
