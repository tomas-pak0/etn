# ETN authentication emails

These Lithuanian/English templates are configured in the ETN Supabase project under Authentication → Emails. `subjects.json` maps the Dashboard template names to their subjects and HTML files.

Keep `{{ .ConfirmationURL }}` unchanged. Supabase supplies the action-specific verification link and the configured return URL; ETN handles the PKCE callback. The recipient must open the link in the same browser where the flow began.

The templates contain no credentials, recipient data, tracking or external image requests. Configure production SMTP before enabling public ETN registration. A saved template and a Dashboard preview do not verify SMTP delivery or an end-to-end registration.

Reference: https://supabase.com/docs/guides/auth/auth-email-templates
