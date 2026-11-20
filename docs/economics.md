# ClipFarm economics

Estimates use published US USD list rates checked November 20, 2026. The renderer timings below are planning assumptions, not production measurements.

## A 30-minute source yielding five clips

| Component | Assumption | Estimated cost |
| --- | --- | ---: |
| Transcription | 30 minutes of Workers AI Whisper turbo at $0.000513/min | $0.01539 |
| Ranking | 35,000 input tokens and 2,000 output tokens at $0.045/$0.384 per million tokens | $0.00234 |
| Container CPU | 60–240 active vCPU seconds at $0.000020/second | $0.0012–$0.0048 |
| Container RAM and disk | 6 GiB and 12 GB for 120–420 active seconds | $0.0019–$0.0067 |
| Stored media | Five 20 MB exports, held for seven days in R2 Standard | ~$0.00035 |
| Container network | Up to 100 MB at $0.04/GB if billed above plan allowance | Up to $0.004 |
| Worker, queue, database | Low traffic and small records | Allow $0.001/job |

Planning budget **$0.02–$0.06 per job**, or **$0.004–$0.012 per clip** if five clips deliver. The upper end allows for slower inputs or a recoverable retry. An empty or failed job can still incur costs, especially after transcription. Workers Paid starts at $5/month and includes some CPU, storage and other usage. The estimate uses marginal list rates before those included allowances. R2 bills operations and has no direct egress fees.

## $12 credit pack

- 3,000 credits at 100 per delivered clip gives 30 clips, or $0.40 gross per clip.
- US Stripe standard domestic-card pricing of 2.9% + $0.30 leaves about **$11.35** after the $0.65 payment fee.
- Six typical five-clip jobs cost an estimated **$0.12–$0.36**, leaving **$10.99–$11.23 per pack** before fixed infrastructure, support, refunds, tax, and acquisition.
- The expensive pattern is buying 30 clips and requesting one per 60-minute source. Transcription alone costs **$0.92** across those 30 jobs. Monitor source minutes per delivered clip, zero-yield jobs, actual container seconds, refunds, and fraud. Use paid acquisition results to price future packs.

The maximum first-order acquisition cost is the measured contribution after all operating and refund allowances. For initial ads, treat **$6 per first purchase** as a test target, rather than a forecast. Start with this one pack and use actual job and purchase distributions before pricing subscriptions.

Sources: [Whisper turbo](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/), [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/), [Container pricing](https://developers.cloudflare.com/containers/platform/pricing/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [Stripe US pricing](https://stripe.com/pricing).
