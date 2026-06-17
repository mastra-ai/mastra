import { useParams } from 'react-router';
import { topics } from './topics-data';

export function TopicCrumb() {
  const { topicId } = useParams<{ topicId: string }>();
  if (!topicId) return null;

  const topic = topics.find(topic => topic.id === topicId);
  const subtopic = topics.flatMap(topic => topic.subtopics).find(subtopic => subtopic.id === topicId);

  return topic?.name ?? subtopic?.name ?? topicId;
}
