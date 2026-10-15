# ETN explorer service

Published service: https://etn-explorers.t0m45-p4k0.chatgpt.site

This directory is the 0.7.0 source snapshot of the separately hosted ETN account service. It uses Sites-owned ChatGPT sign-in and a D1 database. GPS points and routes are not uploaded; authenticated devices send only aggregate country percentages. The database migration is under drizzle/. Device pairing, consent, ranking and deletion are implemented in app/community.ts.

Validation: node community.test.cjs and TypeScript noEmit. The integration test covers 12 users, the top 10 plus the actual 12th position, independent home-country flags, score validation, monotonic progress, consent and account deletion.

No signing keys, device access tokens or user records are included. The existing live Site remains the canonical deployment repository; this snapshot documents the Android release.
