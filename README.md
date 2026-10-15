# ARQ — RIZN Barber Technologies

Coming-soon website, tester applications, launch signup, private lead management, and Resend transactional email outbox.

## Cloudflare deployment

Use Node 24. Install with `pnpm install --frozen-lockfile`, then `pnpm test` and `pnpm build`.
Cloudflare Workers Builds: repository root, build command `pnpm test && pnpm build`, deploy command `pnpm deploy`. Disable preview builds to avoid preview submissions entering the production database.

`wrangler.jsonc` binds the existing `arq-leads` D1 database. The deploy script applies versioned migrations before deploying. All assets pass through the Worker so administrator HTML and scripts cannot bypass authentication.

## Required runtime configuration

Configure secret values in Cloudflare Worker Settings, never in GitHub:
- `RATE_LIMIT_SALT`: random 32-byte secret for hashed IP rate counters.
- `RESEND_API_KEY`: sending-only Resend key restricted to the verified ARQ domain.
- `ACCESS_TEAM_DOMAIN`: `https://<team>.cloudflareaccess.com`.
- `ACCESS_AUD`: audience of the ARQ administrator Access application.

Create a Cloudflare Access self-hosted application covering `/admin*` and `/api/admin*` on the production hostname. Allow only `founders@thearqofficial.com`, using email one-time PIN or an appropriate identity provider. Use the same application audience for both paths. The Worker cryptographically checks issuer, audience, expiration, signature, and the approved email. It rejects forged identity headers and remains closed if Access is unconfigured. Public forms remain public.

Keep `EMAIL_ENABLED` false until the domain, API key, and test recipient are approved. Set true in wrangler.jsonc when enabling delivery; later deploys otherwise restore false. Mail goes to the applicant/subscriber and earlyaccess@thearqofficial.com. Reply-To is earlyaccess@thearqofficial.com.

Each new lead atomically queues two messages. Duplicate submissions do not send again. The Worker drains up to ten pending messages after signup and every five minutes. Stable payloads and idempotency keys protect retries; ambiguous attempts older than 23 hours require review. `accepted` means accepted by Resend, not proof of inbox delivery. Review delivery/bounces in Resend. Admin `/api/admin/email-status` provides aggregate queue state without exposing email bodies.

## Launch checklist

- Confirm complete privacy contact details and canonical domain.
- Configure database, rate salt, Access, and Resend.
- Test real submissions, confirmation and notification delivery, admin sign-in, CSV export, and duplicate behavior.
- Add the domain to Cloudflare; preserve all Namecheap Private Email and Resend DNS records during any nameserver migration.
- Check HTTPS and root/www redirects before launching.
- Non-production hostnames carry `X-Robots-Tag: noindex, nofollow`.

No analytics or tracking scripts are installed. Process unsubscribe requests before sending later launch campaigns. This site sends only immediate submission acknowledgments; bulk campaigns and storefront checkout are not implemented.

## Local development

`pnpm dev` runs localhost:4317 with SQLite. Set LOCAL_ADMIN_PASSWORD (16+ characters) to enable local Basic-auth admin. Local development never sends real emails. `.local`, secrets, and dependency caches must never be committed.
