import { describe, it, expect } from '@jest/globals';
import dotenv from 'dotenv';

import { MastraDocument } from './document';

dotenv.config();

const sampleMarkdown = `
# Complete Guide to Modern Web Development
## Introduction
Welcome to our comprehensive guide on modern web development. This resource covers essential concepts, best practices, and tools that every developer should know in 2024.

### Who This Guide Is For
- Beginning developers looking to establish a solid foundation
- Intermediate developers wanting to modernize their skillset
- Senior developers seeking a refresher on current best practices

## Core Concepts

### 1. Frontend Development
Modern frontend development has evolved significantly. Here are the key areas to focus on:

#### HTML5 Semantic Elements
Using semantic HTML improves:
- Accessibility
- SEO performance
- Code readability
- Maintenance

\`\`\`html
<header>
    <nav>
        <ul>
            <li><a href="#home">Home</a></li>
            <li><a href="#about">About</a></li>
        </ul>
    </nav>
</header>
\`\`\`

#### CSS Best Practices
1. Use CSS Custom Properties
2. Implement responsive design
3. Follow BEM methodology
4. Optimize performance

### 2. JavaScript Fundamentals

JavaScript is the backbone of web development. Here's what you need to know:

\`\`\`javascript
// Modern JS features
const exampleFunction = async () => {
    try {
        const response = await fetch('https://api.example.com/data');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
    }
};
\`\`\`

#### Key Concepts:
- Promises and async/await
- ES6+ features
- TypeScript integration
- Module systems

### 3. Backend Development

Backend development requires understanding:

1. **Server Architecture**
   - RESTful APIs
   - GraphQL
   - Microservices

2. **Database Management**
   - SQL vs NoSQL
   - Query optimization
   - Data modeling

3. **Security Considerations**
   - Authentication
   - Authorization
   - Data encryption

## Tools and Technologies

### Essential Developer Tools

| Category | Tools |
|----------|-------|
| Version Control | Git, GitHub |
| Package Managers | npm, yarn |
| Bundlers | webpack, Vite |
| Testing | Jest, Cypress |

### Framework Selection

#### Frontend Frameworks
1. React
   - Component-based architecture
   - Virtual DOM
   - Large ecosystem

2. Vue
   - Progressive framework
   - Easy learning curve
   - Great documentation

3. Angular
   - Full-featured framework
   - TypeScript integration
   - Enterprise-ready

#### Backend Frameworks
- Node.js/Express
- Django
- Ruby on Rails
- Spring Boot

## Best Practices

### Code Quality
- Write clean, maintainable code
- Follow SOLID principles
- Implement proper error handling
- Use consistent formatting

### Performance Optimization
1. Minimize HTTP requests
2. Optimize images
3. Implement caching
4. Use lazy loading

### Security Measures
- Implement HTTPS
- Sanitize user input
- Use secure dependencies
- Regular security audits

## Deployment and DevOps

### Continuous Integration/Continuous Deployment (CI/CD)
1. Automated testing
2. Build automation
3. Deployment automation
4. Monitoring and logging

### Cloud Services
- AWS
- Google Cloud Platform
- Azure
- Heroku

## Conclusion

Remember that web development is an ever-evolving field. Stay current with:
- Industry trends
- New tools and frameworks
- Security best practices
- Performance optimization techniques

### Additional Resources

* [MDN Web Docs](https://developer.mozilla.org)
* [Web.dev](https://web.dev)
* [CSS-Tricks](https://css-tricks.com)
* [JavaScript.info](https://javascript.info)

---

> "Any application that can be written in JavaScript, will eventually be written in JavaScript." - Jeff Atwood

---

**Note**: This guide is regularly updated to reflect current web development practices and standards.
`;

describe('MastraDocument', () => {
  it('initialization', () => {
    const doc = new MastraDocument({ text: 'test' });
    expect(doc.documents).toHaveLength(1);
    expect(doc.documents[0]?.text).toBe('test');
  });

  it('initialization with array', () => {
    const doc = new MastraDocument([{ text: 'test' }, { text: 'test2' }]);
    expect(doc.documents).toHaveLength(2);
    expect(doc.documents[0]?.text).toBe('test');
    expect(doc.documents[1]?.text).toBe('test2');
  });

  it('chunk - no metadata', async () => {
    const doc = new MastraDocument({ text: sampleMarkdown });

    const nodes = await doc.chunk({
      strategy: {
        chunkSize: 100,
        chunkOverlap: 0,
        separator: `\n`,
        paragraphSeparator: `\n`,
        secondaryChunkingRegex: `/(\n)/g`,
      },
    });

    expect(nodes.length).toBe(10);
  });

  it('chunk - metadata title', async () => {
    const doc = new MastraDocument({ text: sampleMarkdown });

    const nodes = await doc.chunk({
      parseMarkdown: true,
      strategy: {
        chunkSize: 100,
        chunkOverlap: 0,
        separator: `\n`,
        paragraphSeparator: `\n`,
        secondaryChunkingRegex: `/(\n)/g`,
      },
    });

    expect(nodes[0]?.toJSON().text).toBe(`Complete Guide to Modern Web Development`);
    expect(nodes.length).toBe(27);
  }, 500000);
});
