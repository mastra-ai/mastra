# The framework singleton

We are gonna rename a few of the apis (https://docs.google.com/document/d/1zQvsnRPjjWf3O-B79-qaP_dZEdJITYAuiVVcZFrsBcQ/edit) and will write this afterwards.

Kepler uses the following naming convention:

- \_\_ (double underscore) to indicate for framework use
- \_ (single underscore) to indicate for framework & integration authors
- No underscores to indicate functions for public use

The public apis should be around the key objects (Integrations, Events, Apis). For each object, we should have one public singular getter and one public plural getter. So eg: `getIntegrations`, `getEvents` (getEventTypes?), `getApis`, `getIntegration`, `getEvent`, `getApi`.
