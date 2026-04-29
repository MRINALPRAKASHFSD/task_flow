# Governance

## Overview

TaskFlow is a single-maintainer open-source project. This document describes
how decisions are made, how releases are managed and how the project may evolve
its governance structure in the future.

---

## Maintainer

| Role        | GitHub                                                   |
|-------------|----------------------------------------------------------|
| Maintainer  | [@MRINALPRAKASHFSD](https://github.com/MRINALPRAKASHFSD) |

The maintainer is responsible for:

- Reviewing and merging pull requests.
- Triaging and closing issues.
- Publishing releases.
- Maintaining the security posture of the repository.
- Updating dependencies and GitHub Actions pins.
- Enforcing the Code of Conduct.

---

## Decision Making

### Small changes

Typo fixes, dependency updates and minor code improvements may be merged by the
maintainer at any time without formal discussion.

### Feature additions

1. A GitHub Issue (feature request) must be opened first.
2. The maintainer reviews the proposal, may ask for clarification, and either
   approves it for implementation or declines it with a reason.
3. Once approved, a pull request implementing the feature is reviewed and merged.

### Breaking changes

Breaking changes require a GitHub Issue labelled `breaking-change` and a
discussion period of at least seven days before implementation begins.

### Architectural changes

Significant changes to the project structure, technology stack or data model
must be documented as an Architecture Decision Record in `docs/ARCHITECTURE.md`
before work begins.

---

## Release Management

TaskFlow uses [Semantic Versioning](https://semver.org/).

| Version segment | When it changes |
|-----------------|-----------------|
| MAJOR (X.0.0)   | Breaking changes incompatible with previous releases |
| MINOR (0.X.0)   | New backward-compatible features |
| PATCH (0.0.X)   | Backward-compatible bug fixes |

### Release process

1. Update `CHANGELOG.md` — move items from `[Unreleased]` to the new version section.
2. Bump the version in `package.json`.
3. Commit: `chore(release): v<version>`.
4. Create an annotated Git tag: `git tag -a v<version> -m "Release v<version>"`.
5. Push the tag: `git push upstream v<version>`.
6. Create a GitHub Release from the tag with the changelog entry as the description.

---

## Becoming a Maintainer

There are no formal criteria defined at this time. If the project grows to
require additional maintainers, trusted long-term contributors may be invited.

---

## Changes to This Document

Changes to governance policy are proposed as pull requests and require the
maintainer's approval.
