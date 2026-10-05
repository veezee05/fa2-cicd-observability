# Site Reliability Engineering — Lost & Found Portal

Covers Unit IV: observability, service level management, and incident response.

---

## 1. The three pillars of observability

Monitoring tells you *that* something is wrong. Observability lets you ask *why*
without shipping new code.

| Pillar | What it answers | Implemented with | Status |
|---|---|---|---|
| **Metrics** | "Is it healthy? How fast? How many?" | Prometheus + node/nginx/blackbox exporters | ✅ Implemented |
| **Logs** | "What exactly happened at 14:32?" | nginx access/error logs via `docker logs`; Loki is the next step | ⚠️ Partial |
| **Traces** | "Where in the request path was the time spent?" | Not implemented — see note below | ❌ Out of scope |

**On traces:** distributed tracing answers "which service in the chain was slow."
This application is a single nginx container serving static assets, so there is
no chain to trace. Adding OpenTelemetry here would produce spans with one
segment and demonstrate nothing. Tracing becomes meaningful when the API tier is
added. Stating this honestly is better than instrumenting it for show.

---

## 2. Service Level Indicators (SLIs)

An SLI is a measured number describing service quality from the **user's**
point of view — not CPU or memory, which are causes rather than symptoms.

| SLI | Definition | Metric |
|---|---|---|
| **Availability** | Share of synthetic probes that get HTTP 200 | `probe_success{job="blackbox-http"}` |
| **Latency** | Time to complete a probe request | `probe_duration_seconds{job="blackbox-http"}` |

Both are collected by `blackbox-exporter`, which requests the site the way a
browser does. That matters: a container can be "running" while serving 502s.
Probing the real endpoint measures what users actually get.

---

## 3. Service Level Objectives (SLOs)

An SLO is the internal target for an SLI.

| SLO | Target | Window | Query |
|---|---|---|---|
| Availability | **≥ 99.0%** | 30 days | `avg_over_time(probe_success[30d])` |
| Latency | **95% of probes < 1s** | 30 days | `quantile(0.95, probe_duration_seconds)` |

### Why 99% and not 99.99%

Each extra nine costs disproportionately more — multi-AZ redundancy, load
balancers, automated failover. This is a campus utility on a single EC2
instance; 99% permits the maintenance and deploys the project actually needs.
**Choosing an achievable SLO is an engineering decision, not a lack of ambition.**
An SLO you routinely miss is worse than no SLO, because the team learns to
ignore it.

### Error budget

A 99% SLO allows 1% unavailability:

| Window | Permitted downtime |
|---|---|
| 30 days | **7 hours 12 minutes** |
| 7 days | 1 hour 41 minutes |
| 1 day | 14 minutes 24 seconds |

The error budget is what makes the SLO useful. It converts reliability from an
argument into arithmetic:

- **Budget remaining** → ship features, take deployment risk.
- **Budget exhausted** → freeze releases, spend the sprint on reliability.

It deliberately prices the tension between velocity and stability, so the
decision is driven by data rather than by whoever argues hardest.

Live on the Grafana **SLO & Service Health** dashboard as *Error budget
remaining*.

---

## 4. Service Level Agreement (SLA)

**There is no SLA for this service**, and that is correct.

An SLA is a *contract* with consequences — refunds, credits, penalties. SLOs are
internal targets; SLAs are external promises, and are always set **looser** than
the SLO so the team has warning before a contractual breach.

| | Audience | Consequence of breach |
|---|---|---|
| SLI | Engineering | — (it is a measurement) |
| SLO | Engineering | Release freeze, reliability work |
| SLA | Customer / legal | Financial or contractual penalty |

A campus portal with no paying customers has nobody to compensate. Publishing an
SLA here would be theatre.

---

## 5. Alerting philosophy

Alerts are **symptom-based first**. `alerts.yml` is ordered accordingly:

1. **SLO alerts** — fire because users are affected (`ApplicationDown`,
   `HighResponseLatency`, `AvailabilityErrorBudgetBurn`)
2. **Infrastructure alerts** — likely causes (`HostHighCPU`, `HostLowMemory`,
   `HostLowDisk`)
3. **Meta alerts** — monitoring watching itself (`TargetDown`)

High CPU with the site responding fine is not worth waking anyone for. The site
being down *is*, whatever the CPU says.

**Inhibition** is configured in `alertmanager.yml`: when `ApplicationDown` fires,
`HighResponseLatency` is suppressed for the same instance. A down service has no
meaningful latency, and two alerts for one failure is how alert fatigue starts.

| Alert | Severity | Fires after | Meaning |
|---|---|---|---|
| `ApplicationDown` | critical | 1m | Users cannot reach the site |
| `AvailabilityErrorBudgetBurn` | warning | 2m | 30-min availability below 99% |
| `HighResponseLatency` | warning | 5m | Latency SLO breached |
| `HostHighCPU` | warning | 5m | CPU > 85% |
| `HostLowMemory` | warning | 5m | < 15% RAM free |
| `HostLowDisk` | warning | 10m | < 15% disk free |
| `TargetDown` | warning | 2m | Prometheus has lost a scrape target |

---

## 6. Incident response

### Severity

| Sev | Definition | Response |
|---|---|---|
| **SEV1** | Complete outage | Immediate, drop other work |
| **SEV2** | Degraded — slow or partly broken | Within 30 minutes |
| **SEV3** | Minor, no user impact yet | Next working day |

### Process

1. **Detect** — Alertmanager fires, or a user reports it.
2. **Triage** — assign severity. Check Grafana: is this one SLI or everything?
3. **Mitigate before diagnosing.** Restore service first; root-cause afterwards.
   Rolling back a bad deploy beats debugging it live.
4. **Communicate** — who is the incident commander, what is the current status.
5. **Resolve** — confirm the SLI has recovered, not just that the alert cleared.
6. **Post-mortem** — required for every SEV1, within 48 hours.

### <a id="incident-application-down"></a>Runbook — `ApplicationDown`

```bash
# 1. Confirm from outside — is it really down, or is monitoring wrong?
curl -s -o /dev/null -w '%{http_code}\n' http://<PUBLIC_IP>/

# 2. Is the container running?
ssh -i fa1-key.pem ubuntu@<PUBLIC_IP>
cd /opt/lost-and-found && docker compose ps

# 3. If it exited, why?
docker compose logs --tail 50 app

# 4. Mitigate: restart first, investigate after
docker compose up -d app

# 5. Still failing? Roll back to the previous image
docker compose down app
APP_IMAGE=ghcr.io/<owner>/<repo>:<previous-sha> docker compose up -d app

# 6. Confirm recovery via the SLI, not just the container state
curl -s -o /dev/null -w '%{http_code}\n' http://<PUBLIC_IP>/
```

---

## 7. Post-mortems

Post-mortems are **blameless**. The question is "what in the system allowed a
reasonable person to cause this?", not "who broke it." Blame produces hiding;
hiding produces repeat incidents.

### Template

```markdown
# Post-mortem: <short title>

**Date:**            YYYY-MM-DD
**Duration:**        HH:MM – HH:MM (N minutes)
**Severity:**        SEV1 / SEV2 / SEV3
**Error budget consumed:** N minutes of the 432-minute monthly budget (N%)

## Impact
Who was affected, how, and for how long.

## Timeline (UTC)
| Time | Event |
|---|---|
| 14:32 | Deploy of <sha> completed |
| 14:34 | ApplicationDown fired |
| 14:41 | Rolled back to <previous-sha> |
| 14:43 | SLI recovered |

## Root cause
What actually happened, technically.

## Detection
How did we find out? Did monitoring catch it, or did a user? If a user told us
first, that is itself a finding.

## What went well
Genuinely — fast rollback, good runbook, clear alerting.

## What went poorly
Gaps in tooling, process or documentation. Not people.

## Action items
| Action | Owner | Due | Type |
|---|---|---|---|
| ... | ... | ... | Prevent / Detect / Mitigate |
```

### Worked example

```markdown
# Post-mortem: Deploy of bad nginx config caused full outage

**Date:** 2026-10-04   **Duration:** 14:32 – 14:43 (11 min)   **Severity:** SEV1
**Error budget consumed:** 11 of 432 minutes (2.5%)

## Impact
All users received connection refused for 11 minutes. The container restart-looped,
so no requests were served.

## Timeline (UTC)
| Time | Event |
|---|---|
| 14:32 | Pipeline deployed commit a3f91c2 |
| 14:33 | Container entered a restart loop |
| 14:34 | ApplicationDown fired; probe_success dropped to 0 |
| 14:36 | Engineer acknowledged, opened the runbook |
| 14:38 | `docker compose logs app` showed an nginx config syntax error |
| 14:41 | Rolled back to the previous image |
| 14:43 | probe_success returned to 1; alert resolved |

## Root cause
A missing semicolon in `nginx.conf`. nginx refused to start, Docker's
`restart: always` retried in a loop, and the pipeline's smoke test did not catch
it because the build-stage container was started before the config change landed
in the image layer being tested.

## Detection
Automated — blackbox probe detected it within 2 minutes. No user reported it
first, which is the outcome we want.

## What went well
- Alert fired fast and was accurate.
- The runbook was followed directly; rollback took under 3 minutes.
- Error budget absorbed the incident comfortably.

## What went poorly
- CI validated that the image *built*, not that nginx's config *parsed*.
- Rollback was manual; the previous SHA had to be looked up by hand.

## Action items
| Action | Owner | Due | Type |
|---|---|---|---|
| Add `nginx -t` config validation to the CI lint stage | varad | 2026-10-11 | Prevent |
| Make the smoke test assert HTTP 200 before any push | varad | 2026-10-11 | Detect |
| Script one-command rollback to the previous tag | varad | 2026-10-18 | Mitigate |
```

---

## 8. Demonstrating this live

Trigger a real incident end to end:

```bash
# On the instance — stop the app, leaving monitoring running
cd /opt/lost-and-found && docker compose stop app
```

Then watch, in order:

1. **Grafana** — *Current status* flips to `DOWN`, availability starts falling
2. **Prometheus** → Alerts — `ApplicationDown` goes `PENDING`, then `FIRING` after 1m
3. **Alertmanager** — the alert arrives, grouped and routed by severity
4. **Error budget** panel — visibly consumed

Then recover and narrate it:

```bash
docker compose up -d app
```

The SLI returns to 1, the alert resolves, and the budget stops burning. That
sequence — detect, mitigate, verify recovery against the SLI — is the whole
SRE loop in about three minutes.
