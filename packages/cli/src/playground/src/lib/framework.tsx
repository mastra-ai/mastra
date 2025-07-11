import { Link as RouterLink } from 'react-router';
import { LinkComponent } from '@mastra/playground-ui';

export const Link: LinkComponent = ({ children, href, ...props }) => {
  return (
    <RouterLink to={href} {...props}>
      {children}
    </RouterLink>
  );
};
