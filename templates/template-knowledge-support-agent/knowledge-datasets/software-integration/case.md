# Fictional integration case INT-0203

Fictional service record, Example App, 2026-11-14. Technician alias: Morgan. Software: synthetic HTTP client. Report: an authorized test request returned 401. Observations: WWW-Authenticate advertised the expected challenge scheme, but the client had omitted authentication. Diagnostics: compared the selected method without recording credential values; an authorized operator enabled the intended method using a synthetic credential outside the record. Outcome: the next authorized test returned 200. Fictional technician verified the response. Applicability: confirmed omitted authentication only; a 401 response by itself does not establish this cause.

Private synthetic marker: INTEGRATION_EXAMPLE_APP_INDIGO.
