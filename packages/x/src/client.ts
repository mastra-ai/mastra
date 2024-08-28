import { TwitterApi } from 'twitter-api-v2';

export class XClient {
  // @ts-ignore
  private token: string;
  private client: TwitterApi['v2'];

  constructor({ token }: { token: string }) {
    this.token = token;
    this.client = new TwitterApi(token).v2;
  }

  async createTweet(tweet: string) {
    return await this.client.tweet({ text: tweet });
  }
}
