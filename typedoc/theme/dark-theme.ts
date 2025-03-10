import { DefaultTheme, Renderer } from 'typedoc';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DarkTheme extends DefaultTheme {
  constructor(renderer: Renderer) {
    super(renderer);

    // Point to our CSS file
    this.application.options.setValue('customCss', path.join(__dirname, 'dark.css'));
  }
}
