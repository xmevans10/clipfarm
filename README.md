# ClipFarm

Paste a direct video link, choose 1–10 clips, and download captioned 9:16 MP4s. Each delivered clip costs 100 credits. A $12 pack provides 3,000 credits, enough for 30 clips.

ClipFarm accepts direct HTTPS MP4, MOV and WebM sources with audio, from 20 seconds through 60 minutes and up to 800 MB. It is designed for speech-heavy footage. It transcribes and renders the same selected audio stream, chooses real subtitle boundaries, preserves the whole image in wide shots, and returns fewer clips when it cannot find enough candidates. Downloads expire after seven days.

## Deployment

Cloudflare beta: [clipfarm.xmevans10.workers.dev](https://clipfarm.xmevans10.workers.dev).

## Run and deploy

Prerequisites are Node, Python 3, Docker, and a Cloudflare account with Workers Paid and Containers access.

```sh
npm ci
npm run check
npm run db:local
npm run dev
```

For an end-to-end local job, Workers AI uses your Cloudflare account. Give a test account credits using a D1 development query. Create the production resources in `wrangler.jsonc`, supply the database ID for that account, and run:

```sh
npm run db:remote
npx wrangler r2 bucket lifecycle add clipfarm-media expire-exports results/ --expire-days 7
npm run deploy
```

The Worker handles accounts, Stripe Checkout, credit settlement, queue orchestration and private R2 results. A Cloudflare Container handles bounded source download, FFmpeg and object uploads. Workers AI runs Whisper transcription and Llama ranking.

## Enable purchases

Use a Stripe test account first. Install `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` through Cloudflare secrets. Configure Stripe to send `checkout.session.completed` to `https://YOUR_WORKER/api/stripe/webhook`. Complete a test purchase and verify that 3,000 credits are applied exactly once, including after webhook redelivery. Change both values and the endpoint to live mode before launch. Checkout stays unavailable while either secret is missing. The starter pack is a one-time payment.

For invited beta testers, an operator can grant credits with a parameterized D1 update by verified account email. Signup provides zero credits. Plan for email verification, password recovery, refunds and account deletion workflows before a broad paid launch.

## Handoffs

- [Unit economics](docs/economics.md)
- [Muse distribution prompt](marketing/MUSE.md)
- [Creative files and generation prompts](marketing/creative/README.md)

Watch pages, including YouTube, are currently outside the supported import flow. Use a direct link to source footage you have permission to process.
