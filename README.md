# Pick The Best Card 💳

> Never leave rewards on the table. Pick The Best Card tells you exactly which credit card to use at any store.

🌐 **Live at [pickthebestcard.com](https://pickthebestcard.com)**

## The Problem

You have multiple credit cards. Each one earns different rewards at different stores — 5% here, 3x points there, rotating categories that change every quarter. Keeping track of it all is a full-time job.

Pick The Best Card solves this with a simple question: **where are you shopping?** It tells you which card in your wallet earns the most.

## Features

- 🔍 **Search any store** — 200+ merchants preloaded across all categories
- 💳 **Your wallet** — add the cards you actually own
- 🏆 **Instant ranked recommendations** — best card at the top, every time
- 🔄 **Rotating category support** — Discover 5%, Chase Freedom Flex, and others tracked with active dates
- 💰 **Points valuation** — converts points to real dollar value (e.g. 3x Chase UR = ~6%)
- 🔗 **Official benefit links** — links to each card's official benefits page

## Stack

- **Framework**: Next.js 14 (App Router)
- **Auth**: NextAuth v4 with Google Sign-In
- **Database**: Neon Postgres (serverless)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel
- **Crawler**: Playwright + GPT-4o-mini (official issuer pages only)

## Cards Supported

80+ cards across all major issuers:
- **Chase** — 40 cards (Sapphire, Freedom, Ink, co-branded)
- **American Express** — 14 cards (Platinum, Gold, Delta, Hilton, Marriott)
- **Capital One** — 12 cards (Venture X, Savor, Quicksilver)
- **Citi** — 7 cards (Double Cash, Strata Premier, Custom Cash, Costco)
- **Discover, US Bank, Bank of America, Wells Fargo** — key cards

## Benefit Crawler

Benefits are crawled weekly from **official card issuer pages only** — no aggregators.

```bash
cd crawler
npm install
node crawl.js                    # crawl all sources
node crawl.js chase-cards        # single issuer
node crawl.js amex-cards         # opens visible browser (Amex blocks headless)
```

Sources: Chase, Amex, Capital One, Citi, Discover, US Bank, BofA

## Local Development

```bash
# 1. Clone and install
git clone https://github.com/keremsahin1/pickthebestcard.git
cd pickthebestcard
npm install

# 2. Set up env
cp .env.example .env.local
# Fill in: DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, NEXTAUTH_URL

# 3. Run dev server
npm run dev -- --port 3001
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon Postgres connection string |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NEXTAUTH_SECRET` | Random secret for session signing |
| `NEXTAUTH_URL` | Your deployment URL |
| `OPENAI_API_KEY` | For LLM-assisted benefit extraction in crawler |
