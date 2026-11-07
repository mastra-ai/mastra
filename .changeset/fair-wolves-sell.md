---
'@mastra/core': patch
---

Fixed workspace `grep` skipping common template, build and lock files. It now searches `.erb`, `.hbs`, `.handlebars`, `.haml`, `.slim`, `.ejs`, `.mustache`, `.jinja`, `.j2`, `.twig`, `.cshtml`, `.gemspec`, `.lock` (such as `yarn.lock`, `Gemfile.lock` and `Cargo.lock`), `.proto`, `.gradle` and `.properties` files by default. Before, a search for markup in a Rails or Ember view template found nothing. Fixes #28365.
