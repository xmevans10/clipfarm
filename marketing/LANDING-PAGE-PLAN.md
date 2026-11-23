# ClipFarm landing page: make it sell itself

Notes from Ssemble and a concrete plan for `public/index.html`.

**Constraints: no free trials, and this is a frontend-only job.** Every change below is markup, CSS, copy, or static assets. No new endpoints, no database reads, no billing changes, no backend behavior. If a section would need backend work, it is out of scope and must be cut or supported with static assets we already own.

## What Ssemble gets right

1. **The hero sells an outcome, not a tool.** The headline rotates the same promise across verticals: "Reassemble GTA 6 streams into / podcasts into / vlogs into / gameplay into / sports matches into / livestreams into / interviews into Viral Shorts." A visitor sees their own video type in the first line.
2. **Proof sits directly under the CTA.** "Trusted by 3.4M+ shorts clippers | 4.6 out of 5 on Google" and "Plans from $6/mo · Cancel anytime" remove risk before the visitor scrolls.
3. **The CTA repeats after every major section.** "Get Clips Now" appears above the fold, after How It Works, and in the closing band. There is never a long stretch without a next step.
4. **Before/after demos do the explaining.** Game Mode and Sports Mode each get a "Without / With" comparison using the same moment. The product's value is shown, not described.
5. **They prove outcomes with real posts.** "448M views in September 2026", "404,136 clips posted", then a wall of actual TikToks, Reels, and Shorts with view counts and links. This is the strongest section on the page.
6. **They answer "will my footage work?" visually.** A source strip lists YouTube, Vimeo, Kick, Twitch, and file upload with example URLs for each.
7. **Pricing is annual-first and anchored.** Strikethrough monthly price, "SAVE 60%", "You save $216/year", a "Most Chosen Plan" badge, credit math, and a cost-per-video comparison. The buyer does not have to calculate value.
8. **They handle objections in public.** FAQ covers editing experience, languages, monetization, cancellation, credit rollover, and automation.
9. **They give away a playbook.** The 4-step clipper guide and blog posts make them look like the category expert, not just a vendor.
10. **Every section ends on a verb.** Paste, clip, post, earn, start.

What we should copy: the hierarchy, the repetition, the specificity, the before/after demonstration, and the annual-first pricing.
What we must not copy: invented view counts, fake ratings, logo walls, "cancel anytime" language we cannot honor, or features we do not have.

## Where ClipFarm loses the sale today

- **The hero narrows the audience.** "from a single podcast or interview" excludes streamers, webinar hosts, and gaming commentary, which is the larger market the page should address.
- **The best sales asset is buried.** The animated Diary of a CEO source → three shorts demo sits below the form. On mobile, a first-time visitor sees an input field before seeing what comes out.
- **There is one example, in one genre.** Nothing shows an interview, a stream, a webinar, or a gaming commentary clip. Visitors cannot picture their own footage.
- **There is no proof section.** One demo, no testimonials, no "what you get" specification. The page asks for trust and gives little back.
- **There is no free trial, by design.** Signup starts at zero credits, so the page has to earn the first purchase with a live demo, real examples, and a clear smallest paid step. Today it does not give visitors enough evidence.
- **Pricing hides the unit that buyers care about.** Cards show credits, not clips. Monthly is the default. Creator is not marked as the obvious choice. Annual savings are present but not leading.
- **The direct-link limitation is a footnote.** Many visitors will paste a YouTube watch URL and fail. That objection needs to be handled before the form, not in FAQ #3.
- **Only one CTA pattern.** The form and the plan buttons are the only conversion points. There is no closing CTA after the FAQ.
- **The FAQ misses the real questions.** Clip length, vertical framing, caption behavior, watermark, rights, credits, and download expiry.
- **We do not know which section converts.** There is no front-end measurement to tell us where visitors stop.

## The page plan

### 0. Navigation
Keep it short: logo, Examples, How it works, Pricing, Sign in, and one primary button: **Make clips**. The primary button scrolls to the form.

### 1. Hero
Left column: headline, one-sentence offer, and the clip form. Right column: the live source → shorts demo.

- Headline: keep **"Turn long videos into captioned shorts"**. It is clear and already indexed.
- Subhead: **"Paste one video link. Get up to 10 captioned 9:16 clips for Shorts, Reels, and TikTok. No editor, no timeline."**
- Vertical line above or below the subhead: **"Podcasts · Interviews · Streams · Webinars · Gaming commentary"**. Static on mobile, rotating only on desktop, respecting `prefers-reduced-motion`.
- Form: keep the current link field, clip counter, and dynamic button. Change the button label to **"Make my clips"** with the credit count as secondary text.
- Under the button: **"Captions included · 100 credits per finished clip · Downloads ready for 7 days"**. Do not reintroduce a per-clip dollar price.
- Demo: move the existing four-video `conversion` block into the hero's right column on desktop. Keep it below the form on mobile. Add a small **"Watch a real export"** link that opens the best full clip in a dialog.
- Micro-CTA for people who are not ready: **"See what comes out ↓"** anchor to the Examples section.

Why: the visitor sees the transformation before being asked to commit, and the copy speaks to every kind of talking-head footage, not just podcasts.

### 2. Proof strip
A thin band directly under the hero, built from static facts only. No counters, no database reads, no new endpoints.

- Three chips: **"Real exports, not mockups"**, **"Captions baked in"**, **"9:16 ready for Shorts, Reels, and TikTok"**.
- Add one named testimonial only when we have written permission and a real quote.
- Leave the band out if there is nothing true to put in it. A fabricated number is worse than no proof.

### 3. Examples: "See what comes out"
The sales engine. A three- or four-card gallery of real source → output sets.

- Each card: wide source frame, arrow, three vertical clips, a one-line description of the source type, and clip length.
- Categories: Podcast, Interview, Livestream or webinar, Gaming commentary. Use footage we own or have written permission to show.
- Each clip is playable, muted, looped, captioned, and loads only when visible. The current Diary of a CEO set becomes one card, not the whole section.
- Card copy should describe the footage, not claim results: **"A 48-minute interview → three captioned clips."** No view counts unless they are real and linked.
- Add a **"Watch the full export"** link that opens the complete clip in a dialog. Do not offer downloads or free renders.

Why: this is the only section that lets a visitor replace "podcast" with their own video in their head.

### 4. What you get
A compact specification block, not a feature essay.

- **9:16 MP4, 720 × 1280**
- **Captions burned in, styled for mobile**
- **Full frame preserved, with a blurred background fill on wide shots**
- **Up to 10 clips from one source**
- **100 credits per finished clip**
- **Downloads available for 7 days**
- **Source limits: direct HTTPS link, 20 seconds to 60 minutes, up to 800 MB**

Add a one-line plain-English note: **"ClipFarm works best when people are talking. Give it clean speech and enough context for each moment to stand alone."**

Why: this section prevents refunds and support tickets, and it makes the product feel finished.

### 5. How it works
Keep three steps, but make each step visual and result-oriented.

1. **Paste a video link** — "Direct MP4, MOV, or WebM. No upload, no editor."
2. **Pick how many clips** — "One to ten. ClipFarm finds moments that stand on their own."
3. **Download and post** — "Captioned 9:16 MP4s for Shorts, Reels, and TikTok."

End the section with an inline CTA: **"Make your first clip"**.

### 6. "Will my video work?"
Handle the biggest objection before pricing.

- Supported: direct HTTPS links to MP4, MOV, and WebM; 20 seconds to 60 minutes; up to 800 MB; speech-heavy footage.
- Not supported: YouTube watch pages, private or expiring links, DRM-protected sources, silent gameplay with no commentary.
- Give the workaround in plain language: **"Have a YouTube link? Download your own file and paste a direct link to it."**
- Add a small source checklist: clear speech, one speaker or a clean conversation, no music-only sections.

Why: this is where most bounces happen today. Naming the limitation builds more trust than hiding it.

### 7. Pricing
Make the annual plan the default and the obvious value.

- Default the toggle to **Yearly** on the homepage. Keep `?billing=monthly` available for ad tests.
- Lead with **"2 months free on any annual plan"** and show the monthly equivalent under each annual price.
- Mark **Creator** as **"Most popular"**.
- Show **clips included**, not just credits:
  - Starter: 4,000 credits/month, up to 40 clips
  - Creator: 12,000 credits/month, up to 120 clips
  - Pro: 30,000 credits/month, up to 300 clips
  - Top-up: 3,000 credits, up to 30 clips, no subscription
- Keep the verified annual savings line for each plan.
- Add the credit rule: **"Credits are only used for clips that finish."**
- Do not add a per-clip dollar figure, competitor comparison, "cancel anytime", or "manage your plan".

Why: Ssemble makes the buyer do no math. Right now ClipFarm makes them divide credits by 100.

### 8. FAQ
Expand to the questions that block checkout.

- What kind of videos work best?
- How long is each clip?
- How are captions generated? Can I edit them?
- Does ClipFarm crop my video or add a watermark?
- What happens if it finds fewer clips than I asked for?
- When do credits get used?
- How long are downloads available?
- Can I use footage I did not create?
- What happens after I pay?

Answer each in one or two sentences using facts already in the README. Omit any question we cannot answer from verified product behavior. Link the rights answer to the footer disclaimer.

### 9. Closing CTA
A full-width band after the FAQ with the same form or a button back to it: **"Turn one video into a week of shorts."** Secondary line: **"Captions included. No editor required."**

### 10. Footer
Keep the rights reminder. Link Privacy and Terms only if those pages exist; there are none in this repo, so do not add dead links.

## Proof we need to collect

These are the assets that will do the selling. None of them can be faked.

- **Four real source → output sets**, one per category, with written permission for the footage.
- **One full export walkthrough**, 30–45 seconds, screen-recorded from the live product. Show paste, count, render, download. No voiceover.
- **Three named quotes** from beta users, with permission, tied to a specific outcome: "I got my first clip in X minutes", "It found the moment I would have missed."
- **A full-export demo video** so buyers can judge caption quality and framing before paying. Playback only; no download and no free render.
- **One real performance example**, only if a customer will let us link the post and the view count is verifiable.

If we cannot get a proof asset, cut the section. An empty testimonial slot is worse than no testimonial section.

## FE guardrails: claims we must not make

These are copy rules, not backend tasks.

1. **No free trial.** Never write "try free", "free clip", "no card required", or anything else that implies free processing. Signup alone does not grant credits.
2. **No subscription management.** There is no cancel UI, so do not say "cancel anytime" or "manage your plan."
3. **No caption editing.** Do not imply users can fix captions in the product. Say captions are generated automatically.
4. **No watch-page imports.** Say direct HTTPS links only. Do not put a YouTube logo in the supported-sources strip.
5. **No invented proof.** No view counts, user totals, ratings, or testimonials without permission and a real source.
6. **No per-clip dollar price.** Show credits and clips included, not a dollar cost per clip.

## Build order

### Phase 1 — hierarchy and copy (frontend only)
- Move the demo into the hero.
- Broaden the subhead and add the vertical line.
- Add the proof strip, What you get, Will my video work, and closing CTA.
- Expand the FAQ.
- Default pricing to yearly and mark Creator as most popular.
- Keep all new sections static. Use the existing `/api/me` response for plan prices; do not add data sources.

### Phase 2 — proof assets
- Produce four example sets and the full export walkthrough.
- Collect quotes and permissions.
- Add the full-export dialog.
- Replace any placeholder proof with a verified fact from the owner, or cut it.

### Phase 3 — paid entry and confidence
- Make the $12 top-up the explicit low-commitment entry point with no subscription.
- Add a "What happens after you pay" strip: sign in, paste, render, download. Copy only.
- Re-test the page on desktop and mobile. No backend changes.

### Phase 4 — search and sharing
- Add `SoftwareApplication` and `FAQPage` structured data.
- Add a video sitemap entry for the demo export.
- Update OG title, description, and image to match the new hero.
- Consider source-specific landing pages later (podcast clipper, interview clipper, stream clipper), following Ssemble's alternative-page strategy.

## Measurement (optional, frontend only)

Only if an analytics snippet is already installed on the page. Do not add a new analytics vendor, endpoint, or backend pipeline for this redesign.

- `hero_view`
- `form_start`
- `job_submit`
- `signup_open`
- `checkout_start`
- `demo_play`

If those events cannot be added from `app.js` alone, skip measurement and ship the page. The copy and hierarchy work does not depend on it.
