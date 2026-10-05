#!/usr/bin/env python3
"""
Post-deploy health check.

Finds the instance by tag through the AWS API (same discovery principle as the
Ansible dynamic inventory — no IP is hardcoded anywhere), then probes the live
endpoint until it serves traffic.

Exits non-zero if the deployment is not actually serving, which fails the
pipeline. A playbook exiting zero only means the tasks ran; it does not mean
users can reach the site.
"""

import sys
import time
import urllib.request
import urllib.error

import boto3

PROJECT_TAG = "lost-and-found-fa2"
MAX_ATTEMPTS = 20
SLEEP_SECONDS = 6


def find_instance_ip() -> str:
    ec2 = boto3.client("ec2")
    result = ec2.describe_instances(
        Filters=[
            {"Name": "tag:Project", "Values": [PROJECT_TAG]},
            {"Name": "tag:Role", "Values": ["web"]},
            {"Name": "instance-state-name", "Values": ["running"]},
        ]
    )

    for reservation in result["Reservations"]:
        for instance in reservation["Instances"]:
            ip = instance.get("PublicIpAddress")
            if ip:
                print(f"discovered {instance['InstanceId']} at {ip}")
                return ip

    sys.exit(f"No running instance found with tag Project={PROJECT_TAG}")


def probe(url: str) -> None:
    last_error = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            started = time.monotonic()
            with urllib.request.urlopen(url, timeout=10) as response:
                elapsed_ms = (time.monotonic() - started) * 1000
                body = response.read().decode("utf-8", "replace")

                if response.status != 200:
                    raise RuntimeError(f"HTTP {response.status}")
                if "Campus Lost &amp; Found Portal" not in body:
                    raise RuntimeError("page served but expected content missing")

                print(f"OK  HTTP {response.status} in {elapsed_ms:.0f} ms")
                return

        except (urllib.error.URLError, RuntimeError, OSError) as exc:
            last_error = exc
            print(f"attempt {attempt}/{MAX_ATTEMPTS}: not ready ({exc})")
            time.sleep(SLEEP_SECONDS)

    sys.exit(f"Deployment did not become healthy in time. Last error: {last_error}")


def main() -> None:
    ip = find_instance_ip()

    print("\n--- application ---")
    probe(f"http://{ip}/")

    print("\n--- JS module ---")
    probe_module(f"http://{ip}/src/items.js")

    print("\nDeployment verified.")


def probe_module(url: str) -> None:
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            body = response.read().decode("utf-8", "replace")
            if "export function filterItems" not in body:
                sys.exit("items.js served but does not contain expected export")
            print(f"OK  module served ({len(body)} bytes)")
    except Exception as exc:
        sys.exit(f"Could not fetch items.js: {exc}")


if __name__ == "__main__":
    main()
