"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Nfsv4TcpServer = void 0;
const tslib_1 = require("tslib");
const net = tslib_1.__importStar(require("net"));
const Nfsv4Connection_1 = require("./Nfsv4Connection");
const PORT = Number(process.env.NFS_PORT) || Number(process.env.PORT) || 2049;
const HOST = process.env.NFS_HOST
    ? String(process.env.NFS_HOST)
    : process.env.HOST
        ? String(process.env.HOST)
        : '127.0.0.1';
class Nfsv4TcpServer {
    static start(opts) {
        const server = new Nfsv4TcpServer(opts);
        server.start().catch(console.error);
    }
    constructor(opts) {
        this.port = PORT;
        this.host = HOST;
        this.debug = false;
        this.port = opts.port ?? PORT;
        this.host = opts.host ?? HOST;
        this.debug = opts.debug ?? false;
        this.logger = opts.logger ?? console;
        const ops = opts.ops;
        const server = (this.server = new net.Server());
        server.on('connection', (socket) => {
            if (this.debug)
                this.logger.log('New connection from', socket.remoteAddress, 'port', socket.remotePort);
            new Nfsv4Connection_1.Nfsv4Connection({
                duplex: socket,
                ops,
                debug: this.debug,
                logger: this.logger,
            });
        });
        server.on('error', opts.onError ??
            ((err) => {
                if (this.debug)
                    this.logger.error('Server error:', err.message);
                process.exit(1);
            }));
        if (opts.stopOnSigint ?? true) {
            this.sigintHandler = () => {
                if (this.debug)
                    this.logger.log('\nShutting down NFSv4 server...');
                this.cleanup();
                process.exit(0);
            };
            process.on('SIGINT', this.sigintHandler);
        }
    }
    cleanup() {
        if (this.sigintHandler) {
            process.off('SIGINT', this.sigintHandler);
            this.sigintHandler = undefined;
        }
        this.server.close((err) => {
            if (this.debug && err)
                this.logger.error('Error closing server:', err);
        });
    }
    stop() {
        return new Promise((resolve) => {
            this.cleanup();
            this.server.close(() => {
                if (this.debug)
                    this.logger.log('NFSv4 server closed');
                resolve();
            });
        });
    }
    start(port = this.port, host = this.host) {
        if (this.debug)
            this.logger.log(`Starting NFSv4 TCP server on ${host}:${port}...`);
        return new Promise((resolve, reject) => {
            const onError = (err) => reject(err);
            const server = this.server;
            server.on('error', onError);
            server.listen(port, host, () => {
                if (this.debug)
                    this.logger.log(`NFSv4 TCP server listening on ${host}:${port}`);
                server.off('error', onError);
                resolve();
            });
        });
    }
}
exports.Nfsv4TcpServer = Nfsv4TcpServer;
//# sourceMappingURL=Nfsv4TcpServer.js.map