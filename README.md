> \[!IMPORTANT]
>
> This repository holds the sources for Yarn 1.x New releases are tracked on the [yarnpkg/berry](https://github.com/yarnpkg/berry) repository, this one here being revived for personal purposes.

<p align="center">
  Fast, reliable, and secure dependency management.
</p>

---

**Fast:** Yarn caches every package it has downloaded, so it never needs to download the same package again. It also does almost everything concurrently to maximize resource utilization. This means even faster installs.

**Reliable:** Using a detailed but concise lockfile format and a deterministic algorithm for install operations, Yarn is able to guarantee that any installation that works on one system will work exactly the same on another system.

**Secure:** Yarn uses checksums to verify the integrity of every installed package before its code is executed.

## Features

- **Offline Mode.** If you've installed a package before, then you can install it again without an internet connection.
- **Deterministic.** The same dependencies will be installed in the same exact way on any machine, regardless of installation order.
- **Network Performance.** Yarn efficiently queues requests and avoids request waterfalls in order to maximize network utilization.
- **Network Resilience.** A single request that fails will not cause the entire installation to fail. Requests are automatically retried upon failure.
- **Flat Mode.** Yarn resolves mismatched versions of dependencies to a single version to avoid creating duplicates.
- **More emojis.** 🐈

## Installing Yarn

Read the [Installation Guide](https://yarnpkg.com/en/docs/install) on our website for detailed instructions on how to install Yarn.

## Using Yarn

Read the [Usage Guide](https://yarnpkg.com/en/docs/usage) on our website for detailed instructions on how to use Yarn.
