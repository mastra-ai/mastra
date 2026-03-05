import {
  Header,
  HeaderTitle,
  Icon,
  MainContentLayout,
  MainContentContent,
  MetricsDashboard,
} from '@mastra/playground-ui';
import { BarChart3 } from 'lucide-react';

export default function Metrics() {
  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <BarChart3 />
          </Icon>
          Metrics & Logs
        </HeaderTitle>
      </Header>

      <MainContentContent>
        <MetricsDashboard />
      </MainContentContent>
    </MainContentLayout>
  );
}
