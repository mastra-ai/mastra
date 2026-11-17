---
'@mastra/factory': minor
---

Organization admins can now create skills for one Factory from Settings › Skills, without redeploying. Choose **New skill**, give it a name, description and instructions, and the Factory's sessions can load it from their next start. A phase of the Factory's boards can also run it as `runner.skill`. Created skills show a **Custom** badge and can be edited or deleted from the same page. Creating and deleting are recorded in the audit log as `factory.skill.created` and `factory.skill.deleted`.

If the app later ships a skill under the same name, the app's skill takes over the name and the Factory's text becomes an edit of it, which **Revert to original** removes.
