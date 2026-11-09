import { server } from '../agent.js';

server.once('listening', () => process.send?.(server.address()));
