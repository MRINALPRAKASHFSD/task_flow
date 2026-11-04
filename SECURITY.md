# Security Policy

## Supported Versions

Only the latest release of TaskFlow receives security fixes.

| Version | Supported |
|---------|-----------|
| 1.x (latest) | ✅ Active |
| < 1.0        | ❌ End of life |

---

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

### Preferred method — GitHub Security Advisories

1. Navigate to the [Security Advisories](https://github.com/MRINALPRAKASHFSD/task_flow/security/advisories) page.
2. Click **"New draft security advisory"**.
3. Fill in the details: affected versions, description, steps to reproduce and impact.
4. Submit the draft. Only repository maintainers can see it.

You will receive an acknowledgement within **72 hours** and a resolution update within **14 days**.

### What to include

A high-quality report includes:

- A clear description of the vulnerability.
- The component or file affected.
- Reproduction steps (a minimal example is ideal).
- The potential impact (data leakage, arbitrary code execution, etc.).
- Suggested fix if you have one (optional but appreciated).

### What happens after you report

1. The maintainer acknowledges receipt.
2. The vulnerability is assessed for severity and validity.
3. A fix is developed in a private fork.
4. A patched release is published.
5. A public security advisory is created and credited to the reporter (unless they prefer anonymity).

---

## Scope

TaskFlow is a static, client-side application with no backend, no authentication
and no external network requests. Relevant vulnerability classes include:

- **Cross-site scripting (XSS)** via unsafe DOM manipulation.
- **Data exposure** through misuse of LocalStorage.
- **Supply-chain issues** in GitHub Actions dependencies.
- **Information disclosure** in error messages or console output.

Out of scope for this project:
- Server-side vulnerabilities (there is no server).
- Vulnerabilities in browser engines.
- Vulnerabilities in third-party services not under our control.

---

## Security Design Principles

- User-supplied content is always inserted using `textContent` or explicit DOM APIs — never `innerHTML` with unsanitised data.
- `eval` and the `Function()` constructor are not used anywhere in the codebase.
- No external network requests are made at runtime.
- LocalStorage access is wrapped in try/catch to handle unavailability and quota errors, with graceful in-memory session fallback.
- State backup restoration implements strict schema version verification, object structure validation, duplicate ID rejection, and prototype pollution protection.
- State mutation is transactionally guarded: if an import payload contains invalid data or storage fails, the active task store is preserved without partial data corruption.
- GitHub Actions workflows use least-privilege permissions and pin actions to commit SHAs.
- CodeQL static analysis is run on every push to `main` and on pull requests.

---

## Architectural Security Limitations

- **Browser Storage Isolation**: TaskFlow relies on browser LocalStorage and Origin Policy for data isolation. Anyone with access to the user's unlocked device or browser developer profile can inspect local storage keys.
- **Quota Boundaries**: LocalStorage typically enforces a quota (usually ~5MB per origin depending on the browser). Large numbers of tasks or overly large descriptions may reach quota boundaries, triggering read-only in-memory fallback.
- **Client-Side Environment**: Client-side applications cannot provide cryptographically authenticated guarantees against malicious browser extensions with broad DOM access.

---

## Acknowledgements

We recognise and appreciate responsible disclosure. Reporters will be credited
in the security advisory (unless anonymity is requested).
