# Security and Privacy

## What This Project Stores

Depending on your configuration, the system may store:

- scorer-entered names
- candidate names
- scores
- device tokens
- browser fingerprint hashes
- IP addresses
- user agents
- audit log metadata

Treat the deployed database as sensitive.

## Production Checklist

- Use strong passcodes for judge, member, and admin access.
- Use a long random `APP_SECRET`.
- Do not reuse passcodes across events.
- Restrict admin page access operationally.
- Treat Excel imports as trusted-admin input. The default implementation uses `xlsx`, which currently has upstream advisories with no patched release. Avoid public unauthenticated uploads and consider swapping the parser if your threat model requires untrusted file processing.
- Review exported files before sharing.
- Delete or archive D1 data according to your organization's retention rules.
- Do not commit `.dev.vars`, `.wrangler`, cookies, logs, candidate imports, exports, or screenshots with real data.

## Public Repository Checklist

Before pushing a public fork, scan for:

```bash
rg -n "your-domain|database_id|PASSCODE|APP_SECRET|\\.xlsx|cookie|token|真实姓名"
```

Then manually inspect:

- `wrangler.toml`
- `.dev.vars.example`
- `public/`
- `outputs/`
- `tmp/`
- `scripts/`

## Responsible Disclosure

If you find a vulnerability, please open a private advisory or contact the maintainer without publishing exploit details first.
