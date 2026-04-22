---
# Pull Request Template — TaskFlow
# Please fill in all sections. Incomplete PRs may be returned for revision.

## Summary

<!-- A clear description of what this PR does and why. -->

## Related Issue

<!-- Link the issue this PR addresses. Use "Closes #<issue-number>" to auto-close. -->

Closes #

## Type of Change

<!-- Check all that apply. -->

- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ New feature (non-breaking change that adds functionality)
- [ ] 💥 Breaking change (fix or feature that changes existing behaviour)
- [ ] 📝 Documentation update
- [ ] 🎨 Style / formatting (no logic change)
- [ ] ♻️  Refactor (no feature change, no bug fix)
- [ ] ✅ Test update or addition
- [ ] 🔧 Chore (build, CI, dependencies)
- [ ] 🔒 Security fix

## Implementation Details

<!-- Explain the key implementation decisions. Reference relevant files or functions. -->

## Testing Checklist

- [ ] `npm test` passes locally (72/72 tests green).
- [ ] New logic is covered by unit tests in `tests/`.
- [ ] Manually tested in Chrome (latest).
- [ ] Manually tested in Firefox (latest).
- [ ] Manually tested in Safari (if accessible).
- [ ] Tested on mobile viewport (375 px).
- [ ] Keyboard navigation still works correctly.

## Documentation Checklist

- [ ] JSDoc comments updated for changed or new exported functions.
- [ ] `CHANGELOG.md` updated under `[Unreleased]`.
- [ ] `docs/USER_GUIDE.md` updated if user-facing behaviour changed.
- [ ] `docs/ARCHITECTURE.md` updated if structure changed.

## Security Considerations

<!-- Describe any security implications. If none, write "No security impact." -->

- [ ] No `innerHTML` used with unsanitised user input.
- [ ] No `eval` or `Function()` constructor used.
- [ ] LocalStorage access is wrapped in try/catch.
- [ ] No secrets, tokens or credentials introduced.

## Screenshots

<!-- For UI changes, add before/after screenshots or a screen recording. -->
<!-- Delete this section if not applicable. -->

| Before | After |
|--------|-------|
| _screenshot_ | _screenshot_ |

---

<!-- By submitting this PR you confirm that your contribution is made under the MIT License. -->
