# Chat story coverage

`AI/Chat` is a design workbench, with controlled fixtures rather than either application runtime. Studio and Factory have separate composer fixtures. The action row accepts composed controls; it has no application, session or voice mode switch. Only draft text, attachment reading and keyboard submission mechanics are shared between the fixtures.

The visible widgets below are the same playground-ui components imported by production. A story passing does not establish transport, persistence, or live voice behavior.

| Surface                                                                      | Production presentation                                        | Full conversation coverage                           |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| Messages, attachments, text, reasoning                                       | Shared                                                         | Both presets                                         |
| Tools, command lines, arguments, edits, approvals                            | Shared                                                         | App-specific composition                             |
| Notifications, signals, skills, time gaps                                    | Shared                                                         | App-specific composition                             |
| Model selection                                                              | Shared composed ModelPicker menu / segmented combobox group    | Factory and Studio, including personal-chat packs    |
| Composer model settings and advanced fields                                  | Shared ModelSettings                                           | Studio                                               |
| Mode selection                                                               | Shared ComposerModeSelect                                      | Factory personal session                             |
| Attachment actions                                                           | Shared ComposerAttachmentPicker / button                       | Studio URL and local-file menu; Factory image action |
| Send, cancel, dictation and voice controls                                   | Shared Composer buttons / voice-call                           | Both send states; Studio voice fixtures              |
| Tasks, composer ring, thread rail, scrolling                                 | Shared                                                         | Both presets                                         |
| Model locking, missing credentials, loading                                  | Shared presentation; policy remains local                      | Controls and named scenarios                         |
| Factory memory budgets, runtime / connection / queue / goal status, PR links | Mixed: TokenBudget and icons shared; composition remains local | Not included yet                                     |
| Studio read-aloud / dataset actions, run options, browser thumbnail          | Mixed: shared primitives with app-owned composition            | Not included yet                                     |
| Session headers, navigation, history fetching and welcome prompts            | App-owned composition                                          | Fixture header / empty state only                    |

Model and mode changes only update fixture state. Dictation inserts a fixed transcript; voice toggles the production visual states without requesting audio or connecting to LiveKit. Model-pack management is an action callback because it navigates to another application page. Sending during a running turn demonstrates local composer states, not the Controller steering protocol.
