# Hosting assessment — September 13, 2026

La Stazione is hosted on **Netlify**. Its CDN serves the website; serverless functions handle owner access, menu publishing and uploads; Netlify Blobs holds published content and access/session records. The connected GitHub repository deploys automatically when its `main` branch changes. There is no rented always-running server to maintain.

The Netlify account's actual plan and current usage are not available through this workspace. Check **Usage & billing → Billing details → Plan** in the hosting account. Accounts from before September 4, 2025 may still have Legacy Free. Switching from legacy to credits cannot be undone.

| Resource | Current credit-based Free | Legacy Free |
| --- | --- | --- |
| Monthly allowance | 300 credits shared across the team | Separate quotas |
| Production website deployment | 15 credits each | 300 build minutes/month |
| Bandwidth delivered to visitors | 20 credits/GB | 100 GB/month |
| Web requests | 2 credits/10,000 requests | Functions: 125,000 invocations/site/month |
| Serverless compute | 10 credits/GB-hour | Invocation-based allowance |
| Concurrent builds | 1 | 1 |

These current rates were changed in April 2026, so older articles may quote different prices. The free credit plan's resources all use the same 300-credit allowance. [Current credit rates](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/), [legacy plan table](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-legacy-plans/legacy-pricing-plans/).

## What happens at the limit

On current Free, using all credits pauses **every project in that Netlify team**, including the public website and QR menu, until the monthly reset or an upgrade. Free cannot buy extra credits and has no usage overage charge. Legacy Free handles exhausted build minutes differently: it blocks new builds while keeping the published site online, although other exhausted allowances can pause sites. [Pause rules](https://docs.netlify.com/manage/accounts-and-billing/billing/resume-paused-projects/), [legacy billing FAQ](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-legacy-plans/billing-faq-for-legacy-plans/).

Illustration, not measured traffic: 5,000 visits downloading 2 MB and making 30 requests each, plus four production deployments, use about **290 credits before function compute**: 200 bandwidth + 30 requests + 60 deploys. Photos, caching, menu-only visits, bots and other sites in the same account change the result. Owner menu edits do not cause a Git deployment; they use storage and functions. Development preview publishing has no production-deploy credit charge, but preview traffic still counts. This is a calculation from the current rates, not a capacity guarantee.

## Other practical points

- **Domain and HTTPS:** custom domains and automatic HTTPS are supported on Free. Domain registration/renewal and company email hosting are separate expenses. [HTTPS](https://docs.netlify.com/manage/domains/secure-domains-with-https/https-ssl/), [domains](https://docs.netlify.com/manage/domains/configure-domains/register-and-buy-a-domain/), [email hosting](https://answers.netlify.com/t/email-hosting-services/94874).
- **Business use:** commercial websites can use Free. Being a coffee shop does not by itself require paid hosting. [Netlify Free announcement](https://www.netlify.com/blog/introducing-netlify-free-plan/).
- **Photos/storage:** Free includes Blobs, but current pricing does not publish a separate total storage allowance. Do not assume unlimited storage. Image delivery consumes bandwidth. The owner editor optimizes uploaded images and the server accepts JPEG, PNG or WebP uploads up to 4 MB each; this is the application's limit. [Blobs documentation](https://docs.netlify.com/build/data-and-storage/netlify-blobs/).
- **Support and visibility:** Free has limited monitoring history and no enterprise uptime guarantee. Owner-site editors are separate from Netlify hosting-team seats, so adding an editor here does not require buying another hosting seat. [Plan comparison](https://www.netlify.com/pricing/pro-vs-free/).
- **Backups and moving later:** Git stores the website code; live menu edits and uploaded images are separate Blob data. Keep exported menu backups and copies of original photos. A move is possible, but the content, access and session functions would need their storage integration adapted. This is an inference from the current implementation and [Blob persistence](https://docs.netlify.com/build/data-and-storage/netlify-blobs/).

## Recommendation

Keep Netlify initially and check actual usage after launch. If the account still has Legacy Free, confirm its allowances before changing plans. For a QR menu that must stay available during traffic spikes, paid headroom is usually less work than migrating: current Personal is **$9/month with 1,000 credits**, and Pro starts at **$20/month with 3,000 credits**. Optional automatic credit top-ups can avoid quota pauses but increase spending; they are off by default. Upgrading increases capacity, rather than guaranteeing unlimited service. [Current pricing](https://www.netlify.com/pricing/).
