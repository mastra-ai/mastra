---
'@internal/playground': patch
---

Simplified how datasets and experiments relate in Studio.

**Datasets**

- The dataset page now only shows its items. The Experiments and Review tabs are gone; a **View experiments** button opens the global Experiments page filtered to that dataset (`/experiments?dataset=<id>`).
- The Review column was removed from the datasets table.

**Experiments**

- Compare two experiments from the global Experiments list: click **Compare**, pick two runs of the same dataset, and open `/experiments/compare`.
- Added a **Rerun** button on the experiment page that reopens the run dialog prefilled with the dataset, version, target and scorers of the current run.
- Added a **Flag for review** button when viewing a single experiment item.
- Links to the dataset, agent, workflow or scorer on the experiment page now open in the same tab.
- The Experiment and Target columns in the experiments list show readable names instead of raw ids.
