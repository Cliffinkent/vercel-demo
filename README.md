# SchoolRun OS

School emails in. Family plan out.

SchoolRun OS is a hackathon MVP that turns messy school emails, newsletters and lunch menus into a weekly family calendar, parent action list, lunch panel and source-message history.

## What Works

- Next.js App Router and TypeScript
- Local demo onboarding for Sam at Oakfield Primary
- `/dashboard` opens a ready sample week with calendar, parent actions, lunch menu and collapsed recent sources
- `/add-message` handles pasted school messages, newsletters, lunch menus and the forwarded-email test flow
- `/api/extract` validates input with Zod and extracts structured JSON
- `/api/inbound-email` posts a fake Gmail-style forwarded email through the same extraction pipeline
- Demo parser fallback when AI credentials are missing
- Supabase schema and optional server-side persistence
- ElevenLabs voice briefing route, disabled automatically without env vars
- In-memory browser state for the no-keys demo path

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The app runs without Supabase, AI, or ElevenLabs keys. In that mode `/dashboard` seeds a fake Oakfield Primary sample week and stores demo state in the browser.

## Demo Flow

1. Open `/dashboard` or click `Dashboard` in the header to see the sample week.
2. Click `Add school message` to open `/add-message`.
3. Paste a fake or redacted school message, newsletter or lunch menu, or choose one of the sample tabs.
4. Click `Process message` to extract calendar items, parent actions and lunch menu entries, then return to the dashboard.
5. Use `Run test forwarded email` from `/add-message` or `/setup-forwarding` to send a fake Gmail-style payload through the same extraction path.

Lunch menus are processed through the normal paste/process flow. There is no lunch-menu upload UI in the demo.

## Environment

Copy `.env.example` to `.env.local` and add any keys you want to exercise:

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AI_GATEWAY_API_KEY=
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
```

AI extraction uses Vercel AI SDK structured output when AI credentials are present. Without them, the deterministic demo parser handles the included fake school messages.

## Supabase

Run `supabase/schema.sql` in a Supabase SQL editor or migration. The app uses the service role from server routes only and never exposes it client-side.

Tables:

- `children`
- `ingested_messages`
- `events`
- `tasks`

RLS is enabled. Add authenticated user policies before turning this into a real family-data product.

## Security Notes

- Use fake or redacted school messages for this demo.
- API input is validated with Zod.
- Raw text is limited to 12,000 characters.
- Server errors are returned as safe user-facing messages.
- Full raw messages are not logged in production.
- Demo API endpoints use simple in-memory rate limiting.
- UI renders text through React, with no unsafe HTML.

## Build

```bash
npm run build
```

Deploy on Vercel as a standard Next.js app.
