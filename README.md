# Hosted Vatika demo

Status: prepared, not deployed. The existing temporary tunnel still requires the owner's computer.

Run `node scripts/prepare-hosted.mjs` from the source workspace. Publish only the resulting `outputs/hosted-vatika` directory to a private deployment repository; it contains the actual approved interface and assets, not the unused starter application. No dependencies need installing. Docker runs native Node 24.

## Hosting and cutover

1. Obtain approval for Render Starter hosting plus a 1 GB persistent disk, separately from OpenAI usage. Connect the owner's Render account and deploy the generated package using its render.yaml. Keep GENERATION_ENABLED=false initially.
2. Set OPENAI_API_KEY as a private server environment variable using the already approved key. Never add it to source, browser code, build arguments or screenshots. RENDER_EXTERNAL_URL supplies the HTTPS origin; set PUBLIC_ORIGIN only for a verified custom domain.
3. Before enabling hosted generation, stop accepting local paid sessions and let existing requests finish. Stop the old gateway/tunnel and local generator. Read the latest work/generation-usage.json count for the pilot, set INITIAL_USED_SESSIONS to that exact value, and ensure the hosted persistent ledger is at least that count. An initial deployment with a lower count must have its ledger corrected while disabled. Never run both installations with separate spend counters.
4. Verify /healthz, the full interface, secure session cookie, cross-origin rejection, secret-path rejection and private preview access on the hosted URL. Only then set GENERATION_ENABLED=true. Existing user authorisation covers the remaining approved API sessions; do not increase the cap.
5. Test the hosted landing page with the owner's computer disconnected. A real image-generation trial consumes credits; mock tests already exercise queue behaviour without spending.

## Capacity and privacy

One server process, three concurrent single-image jobs, three queued jobs, then a friendly busy response. One active/queued job per browser session. The queue starts automatically and shows each visitor their position; previews display as they finish. Provider rate limits can reduce practical capacity; no automatic paid retries.

The persistent ledger preserves the shared 104-session ceiling, including previous usage. It is a session cap, not an exact dollar billing cap. Failed and cancelled reservations remain counted conservatively. Do not restore an older ledger snapshot or run multiple replicas. Larger events need a shared database and durable worker queue before horizontal scaling.

Uploaded photos and results are held only in server memory, with a 30-minute expiry and early deletion by the client. Total retained output bytes are capped at 96 MB. The persistent disk contains usage counts only, avoiding photo backups. Queued/running work and browser sessions do not survive server restarts; users will see an expired-session message, with no automatic retry. Restarting preserves the usage ledger. Avoid redeploying during the event.

The API key is never sent to visitors. Images remain private to their session cookie. Anyone with the public link can spend the remaining shared allowance, as requested. Hosting is separate from OpenAI credits. This package is not a promise of unlimited concurrency or uninterrupted availability.
