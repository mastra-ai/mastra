---
'@mastra/factory': minor
---

Added a hybrid model scope: sessions run on the owner's credentials and default model, work items run on the Factory's. New Factories start in hybrid; existing Factories keep their scope. Because new Factories now bill members' interactive sessions to their own provider accounts, admins who want everything on organization credentials should switch the Factory to the factory scope.
