import { useStoryboard } from './StoryboardProvider';
import { StoryModelRouting } from './StoryModelRouting';

export function StoryBillingSettings() {
  const storyboard = useStoryboard();
  if (storyboard === null) return null;
  return (
    <div className="mb-8">
      <StoryModelRouting storyboard={storyboard} />
    </div>
  );
}
