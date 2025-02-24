import { MastraVoice } from '.';

export class CompositeVoice extends MastraVoice {
  protected speakProvider?: MastraVoice;
  protected listenProvider?: MastraVoice;

  constructor({ speakProvider, listenProvider }: { speakProvider?: MastraVoice; listenProvider?: MastraVoice }) {
    super();
    this.speakProvider = speakProvider;
    this.listenProvider = listenProvider;
  }

  async speak(input: string | NodeJS.ReadableStream, options?: any) {
    if (!this.speakProvider) {
      throw new Error('No speak provider configured');
    }
    return this.speakProvider.speak(input, options);
  }

  async listen(audioStream: NodeJS.ReadableStream, options?: any) {
    if (!this.listenProvider) {
      throw new Error('No listen provider configured');
    }
    return this.listenProvider.listen(audioStream, options);
  }

  async getSpeakers() {
    if (!this.speakProvider) {
      throw new Error('No speak provider configured');
    }
    return this.speakProvider.getSpeakers();
  }
}
