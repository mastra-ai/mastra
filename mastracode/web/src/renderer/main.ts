import { mountMastraCodeApp } from '@mastra/code-app';
import { WEB_HOST } from '@mastra/code-app/host';

const element = document.getElementById('root');
if (!element) throw new Error('MastraCode web root element is missing');

mountMastraCodeApp({ element, host: WEB_HOST });
