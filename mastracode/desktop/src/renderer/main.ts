import { mountMastraCodeApp } from '@mastra/code-app';
import { createDesktopHost } from '@mastra/code-app/host';

import './renderer.css';

const element = document.getElementById('root');
if (!element) throw new Error('MastraCode desktop root element is missing');

const desktopApi = window.mastracodeDesktop;
if (!desktopApi) throw new Error('MastraCode desktop preload bridge is unavailable');

mountMastraCodeApp({ element, host: createDesktopHost(desktopApi) });
