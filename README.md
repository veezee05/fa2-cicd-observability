# FA2 — CI/CD Pipeline with Monitoring & Observability

Campus Lost & Found Portal — continuation of FA1.

FA1 built the infrastructure (Terraform) and configuration (Ansible with dynamic
inventory). FA2 adds the parts that make it a production pipeline: **automated
build, test and deployment**, and an **observability stack with SLO-based
alerting**.

Covers **Unit III** (CI/CD, Pipeline as Code) and **Unit IV** (Monitoring,
Observability, SRE).

---

## Pipeline

```
   git push
      │
      ▼
┌─────────────────── GitHub Actions ───────────────────┐
│                                                       │
│  lint  ──→  test  ──→  build  ──→  deploy  ──→ verify │
│   │          │          │           │           │     │
│ hadolint   node        docker    Ansible     probe    │
│ HTML tidy  --test      build +   dynamic     live     │
│                        smoke     inventory   endpoint │
│                        + GHCR    → EC2                │
└───────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌──── EC2 (t3.small) ────┐
              │  app          :80       │
              │  prometheus   :9090     │
              │  grafana      :3000     │
              │  alertmanager :9093     │
              │  node-exporter          │
              │  nginx-exporter         │
              │  blackbox-exporter      │
              └─────────────────────────┘
```

## Rubric coverage

| Required stage | Implementation |
|---|---|
| **Source** | Git + GitHub, branch-based workflow |
| **Build** | `docker build`, tagged with commit SHA, pushed to GHCR |
| **Test** | 16 unit tests (`node --test`) + container smoke test + post-deploy probe |
| **Containerization** | Docker + Docker Compose |
| **Deployment** | Ansible with AWS dynamic inventory (carried over from FA1) |
| **Monitoring** | Prometheus, Grafana, Alertmanager, three exporters |

| Required tool | Used for |
|---|---|
| GitHub Actions | CI/CD — Pipeline as Code |
| Docker | Containerization, Compose for the stack |
| Terraform | EC2, security group, EBS |
| Ansible | Configuration and deployment |
| Prometheus / Grafana | Metrics and visualisation |

## Layout

```
FA2/
├── .github/workflows/cicd.yml      # the pipeline — Pipeline as Code
├── app/
│   ├── index.html                  # portal UI
│   ├── src/items.js                # logic, extracted so it is testable
│   ├── tests/items.test.js         # 16 unit tests
│   ├── nginx.conf                  # serving + stub_status for metrics
│   └── Dockerfile
├── terraform/                      # EC2 + security group
├── ansible/                        # dynamic inventory + deploy playbook
├── monitoring/
│   ├── docker-compose.yml          # app + full observability stack
│   ├── prometheus/                 # scrape config, SLO alert rules
│   ├── alertmanager/               # routing, grouping, inhibition
│   └── grafana/provisioning/       # datasource + SLO dashboard as code
├── scripts/verify_deployment.py    # post-deploy health gate
└── docs/SRE.md                     # SLI/SLO/SLA, runbooks, post-mortems
```

---

## What changed from FA1

| | FA1 | FA2 |
|---|---|---|
| Deployment trigger | Run Ansible by hand | `git push` |
| Tests | None | 16 unit + smoke + post-deploy probe |
| Image distribution | Built on the server | Built in CI, pushed to GHCR, pulled by the server |
| Monitoring | None | Prometheus, Grafana, Alertmanager |
| Reliability | Undefined | SLIs, SLOs, error budget, runbooks |
| Instance | t3.micro | t3.small (monitoring stack needs the RAM) |

Carried over unchanged: Terraform IaC, **Ansible dynamic inventory** — no IP is
hardcoded anywhere, including inside the CI runner, which discovers the
deployment target through the AWS API at deploy time.

---

## Setup

### 1. Repository secrets

**Settings → Secrets and variables → Actions:**

| Secret | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM user key (EC2 read + describe) |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret |
| `EC2_SSH_KEY` | Full contents of `fa1-key.pem`, including header and footer lines |

### 2. Provision

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

### 3. First deploy

Push to `main`, or trigger **Actions → CI/CD Pipeline → Run workflow**.

### 4. Open

| | URL |
|---|---|
| Application | `http://<EC2_IP>` |
| Grafana | `http://<EC2_IP>:3000` — `admin` / `devops2026` |
| Prometheus | `http://<EC2_IP>:9090` |
| Alertmanager | `http://<EC2_IP>:9093` |

### 5. Tear down

```bash
terraform destroy
```

---

## Running tests locally

```bash
cd app
npm test
```

---

## Service levels

| | Target | Window |
|---|---|---|
| Availability SLO | 99.0% | 30 days |
| Latency SLO | 95% of requests < 1s | 30 days |
| Error budget | 7h 12m downtime | 30 days |

Full definitions, alert reasoning, runbooks and the post-mortem process are in
[docs/SRE.md](docs/SRE.md).

---

## Demonstrating an incident

```bash
ssh -i fa1-key.pem ubuntu@<EC2_IP>
cd /opt/lost-and-found && docker compose stop app
```

Watch `ApplicationDown` move from `PENDING` to `FIRING` in Prometheus, the
availability SLI fall in Grafana, and the error budget visibly burn. Then:

```bash
docker compose up -d app
```

Detect → mitigate → verify recovery against the SLI. That is the SRE loop.

**Pipeline = automate the release · Observability = know it still works · SRE = decide when to stop shipping**
