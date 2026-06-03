# Contributing

Contributions are welcome.

## Development

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

Before submitting changes:

```bash
npm run build
npm run check
npm run lint
```

## Guidelines

- Keep private event data out of the repository.
- Prefer small, focused pull requests.
- Add tests for scoring logic and ranking behavior when changing shared rules.
- Keep UI copy generic unless the change is explicitly for a private fork.
