import { loadConfig } from '../src/config/load-config.js';
import { initializeStorage } from '../src/storage/initialize-storage.js';

const storage = await initializeStorage(loadConfig());
storage.close();
