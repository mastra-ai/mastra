import { WebClient } from '@slack/web-api';

export class SlackClient {
  // @ts-ignore
  private token: string;
  private client: WebClient;

  constructor({ token }: { token: string }) {
    this.token = token;
    this.client = new WebClient(token);
  }

  async getAllChannels() {
    const response = await this.client.conversations.list({
      types: 'private_channel,public_channel',
      limit: 999,
    });
    return response.channels?.filter(({ is_archived }) => !is_archived);
  }

  async channelByName(channelName: string) {
    const channels = await this.getAllChannels();

    return channels?.find(({ name }) => {
      return name === channelName;
    });
  }

  async getActiveUsers() {
    const { members } = await this.client.users.list({});

    const activeMembers = members?.filter(({ deleted, is_bot }) => !deleted && !is_bot);

    return activeMembers;
  }

  async userIdsByNames(names: string[]) {
    const users = await this.getActiveUsers();

    const peopleIds = users
      ?.filter(({ name }) => {
        if (name) {
          const nameMatch = names.find(n => {
            return n.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(n.toLowerCase());
          });
          return !!nameMatch;
        }
        return false;
      })
      ?.map(({ id }) => id);

    return peopleIds;
  }

  async sendMessage({ channelId, message }: { channelId: string; message: string }) {
    return await this.client.chat.postMessage({
      channel: channelId,
      text: message,
    });
  }

  async invite({ channelId, users }: { channelId: string; users: string[] }) {
    return await this.client.conversations.invite({
      channel: channelId,
      users: users.join(','),
    });
  }

  async createChannel({ name, isPrivate }: { name: string; isPrivate: boolean }) {
    const result = await this.client.conversations.create({ name, is_private: isPrivate });
    return result;
  }

  async joinChannel({ channelId }: { channelId: string }) {
    return await this.client.conversations.join({ channel: channelId });
  }
}
