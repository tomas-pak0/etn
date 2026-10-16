# ETN explorer service

Existing public service: https://etn-explorers.t0m45-p4k0.chatgpt.site

Registration uses Supabase Auth with Google, Facebook and verified email/password. ChatGPT is no longer an account identity. The browser SDK uses PKCE and the server independently checks the token against the configured Supabase project and requires a confirmed email. Browser-supplied identity and ChatGPT identity headers are ignored. An email provider with auto-confirm enabled is blocked. No password, OAuth secret, GPS point or route is stored in D1.

Keep the existing Sites project and D1 binding. Profiles, rankings, country flags, old paired devices and local GPS history are preserved. New identities are namespaced as supabase:<user UUID>; old accounts are never merged based only on an email address or nickname.

## Activation

1. The owner selected the existing Supabase project `mmhumafqifvgterdixpc` (`tomas-pak0's Project`). Its public project URL/key are configured in Sites. `SUPABASE_AUTH_READY=false` keeps sign-up inactive while redirects, providers, SMTP and account deletion are being configured. Do not change existing project data or unrelated redirect entries.
2. In Supabase Auth, enable Email with Confirm Email enabled (mailer_autoconfirm=false). Configure production SMTP for confirmation and password-reset emails; do not rely on test-only delivery. Set a minimum password length of 10.
3. Add the Site origin as Site URL and allow these exact redirects: /auth/callback, /auth/callback?return_to=*, and /auth/reset on the Site origin. Use the redirect allowlist syntax documented by Supabase; avoid unrelated domains.
4. Configure a Google OAuth web client and a Facebook Login application in their respective developer consoles. Put their client IDs/secrets in Supabase provider settings, using the Supabase project callback URL. Enable production access for intended users. Those provider secrets do not belong in ETN source or Sites client code.
5. Set Sites runtime variables SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY. The publishable/legacy anon key is public. Set SUPABASE_SECRET_KEY as a secret server-only admin key so authenticated account deletion can also remove the Supabase authentication record. Never include that key in an APK, AAB, ZIP or Git.
6. Once the configuration above is verified, set `SUPABASE_AUTH_READY=true` and deploy the exact source through Sites. /api/auth/config exposes only public configuration and enabled providers, never the admin key. Until configured, sign-in is shown as unavailable; there is no ChatGPT fallback.
7. Test Google, Facebook and a real verification email with owner-controlled accounts. Unconfirmed emails must fail profile creation and phone approval. No real email is sent by the automated tests.

Tests: node community.test.cjs and node node_modules/typescript/bin/tsc --noEmit. The integration test uses a real SQLite database and a simulated authentication issuer, including rejection of unverified and forged identities, pairing proof, consent, 12-user top 10 + true own rank, country flags, monotonic scores, privacy and deletion of both data and authentication records. These tests do not certify live OAuth or SMTP configuration.

Official setup references:
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/social-login/auth-facebook
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/redirect-urls

The live Site source repository remains canonical. This directory is a source snapshot for the Android release. No signing keys, live tokens or user records are included.
