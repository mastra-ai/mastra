import type { Meta, StoryObj } from '@storybook/react-vite';
import { Threads, ThreadList, ThreadItem, ThreadLink, ThreadDeleteButton } from './threads';

const meta: Meta<typeof Threads> = {
  title: 'Composite/Threads',
  component: Threads,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Threads>;

export const Default: Story = {
  render: () => (
    <div className="w-[280px] h-[400px]">
      <Threads>
        <ThreadList>
          <ThreadItem>
            <ThreadLink href="#">
              <span className="text-icon5">New conversation</span>
            </ThreadLink>
          </ThreadItem>
          <ThreadItem>
            <ThreadLink href="#">
              <span className="text-icon5">Help with code review</span>
            </ThreadLink>
          </ThreadItem>
          <ThreadItem>
            <ThreadLink href="#">
              <span className="text-icon5">API integration question</span>
            </ThreadLink>
          </ThreadItem>
        </ThreadList>
      </Threads>
    </div>
  ),
};

export const WithActiveThread: Story = {
  render: () => (
    <div className="w-[280px] h-[400px]">
      <Threads>
        <ThreadList>
          <ThreadItem>
            <ThreadLink href="#">
              <span className="text-icon5">Previous chat</span>
            </ThreadLink>
          </ThreadItem>
          <ThreadItem isActive>
            <ThreadLink href="#">
              <span className="text-icon5">Current conversation</span>
            </ThreadLink>
          </ThreadItem>
          <ThreadItem>
            <ThreadLink href="#">
              <span className="text-icon5">Another chat</span>
            </ThreadLink>
          </ThreadItem>
        </ThreadList>
      </Threads>
    </div>
  ),
};

export const WithDeleteButtons: Story = {
  render: () => (
    <div className="w-[280px] h-[400px]">
      <Threads>
        <ThreadList>
          <ThreadItem>
            <ThreadLink href="#">
              <span className="text-icon5 truncate">Debugging session</span>
            </ThreadLink>
            <ThreadDeleteButton onClick={() => console.log('Delete thread 1')} />
          </ThreadItem>
          <ThreadItem isActive>
            <ThreadLink href="#">
              <span className="text-icon5 truncate">Feature discussion</span>
            </ThreadLink>
            <ThreadDeleteButton onClick={() => console.log('Delete thread 2')} />
          </ThreadItem>
          <ThreadItem>
            <ThreadLink href="#">
              <span className="text-icon5 truncate">Code review feedback</span>
            </ThreadLink>
            <ThreadDeleteButton onClick={() => console.log('Delete thread 3')} />
          </ThreadItem>
        </ThreadList>
      </Threads>
    </div>
  ),
};

export const LongThreadNames: Story = {
  render: () => (
    <div className="w-[280px] h-[400px]">
      <Threads>
        <ThreadList>
          <ThreadItem>
            <ThreadLink href="#">
              <span className="text-icon5 truncate">
                This is a very long thread name that should be truncated when displayed
              </span>
            </ThreadLink>
            <ThreadDeleteButton onClick={() => console.log('Delete')} />
          </ThreadItem>
          <ThreadItem>
            <ThreadLink href="#">
              <span className="text-icon5 truncate">Another extremely long conversation title that exceeds width</span>
            </ThreadLink>
            <ThreadDeleteButton onClick={() => console.log('Delete')} />
          </ThreadItem>
        </ThreadList>
      </Threads>
    </div>
  ),
};

export const EmptyThreadList: Story = {
  render: () => (
    <div className="w-[280px] h-[400px]">
      <Threads>
        <ThreadList>{/* Empty list */}</ThreadList>
      </Threads>
    </div>
  ),
};

export const ManyThreads: Story = {
  render: () => (
    <div className="w-[280px] h-[400px] overflow-auto">
      <Threads>
        <ThreadList>
          {Array.from({ length: 10 }, (_, i) => (
            <ThreadItem key={i} isActive={i === 2}>
              <ThreadLink href="#">
                <span className="text-icon5">Conversation {i + 1}</span>
              </ThreadLink>
              <ThreadDeleteButton onClick={() => console.log(`Delete thread ${i + 1}`)} />
            </ThreadItem>
          ))}
        </ThreadList>
      </Threads>
    </div>
  ),
};

export const WithTimestamps: Story = {
  render: () => (
    <div className="w-[280px] h-[400px]">
      <Threads>
        <ThreadList>
          <ThreadItem isActive>
            <ThreadLink href="#">
              <span className="text-icon5 truncate">Current discussion</span>
              <span className="text-xs text-icon3">Just now</span>
            </ThreadLink>
            <ThreadDeleteButton onClick={() => console.log('Delete')} />
          </ThreadItem>
          <ThreadItem>
            <ThreadLink href="#">
              <span className="text-icon5 truncate">API design review</span>
              <span className="text-xs text-icon3">2 hours ago</span>
            </ThreadLink>
            <ThreadDeleteButton onClick={() => console.log('Delete')} />
          </ThreadItem>
          <ThreadItem>
            <ThreadLink href="#">
              <span className="text-icon5 truncate">Bug investigation</span>
              <span className="text-xs text-icon3">Yesterday</span>
            </ThreadLink>
            <ThreadDeleteButton onClick={() => console.log('Delete')} />
          </ThreadItem>
        </ThreadList>
      </Threads>
    </div>
  ),
};
