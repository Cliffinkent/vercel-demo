# SchoolRun OS Hackathon MVP Spec

## Objective

Build a working MVP called SchoolRun OS.

Core line: **School emails in. Family plan out.**

The product turns messy school communications into a weekly family calendar and parent action list.

## Target user

A busy parent with one or more children who receives school emails, newsletters, PE reminders, lunch menus, trip forms, payment requests, club notices and INSET day updates.

## Tech stack

Required:
- Next.js App Router
- TypeScript
- Vercel deployment
- Vercel AI SDK for structured extraction
- Supabase for storage
- Codex for build support

Optional:
- ElevenLabs for voice briefing
- Auth0 only as a future production step, do not build unless the MVP is already working

## MVP user journey

1. User opens the site.
2. User creates a simple family profile:
   - Parent name
   - Child name
   - Child age
   - School name
   - School website URL
3. User reaches the dashboard.
4. User can process school information through:
   - pasted school email or newsletter text on `/add-message`
   - pasted lunch menu text on `/add-message`
   - "Run test forwarded email" on `/add-message` or `/setup-forwarding`
5. The app extracts:
   - calendar events
   - parent tasks
   - child notes
   - lunch menu items
   - warnings
   - confidence score
6. The dashboard shows:
   - this week's calendar
   - parent to-do list
   - lunch menu panel
   - collapsed recent source messages
7. The forwarding setup screen explains how Gmail forwarding would work.
8. The test forwarding button sends a fake Gmail-style payload into the same extraction pipeline as pasted text.

## Routes

- `/` onboarding and landing
- `/dashboard` main app
- `/add-message` paste/process and test-message flow
- `/setup-forwarding` Gmail forwarding instructions and test button
- `/api/extract` AI extraction endpoint
- `/api/inbound-email` fake forwarded email endpoint
- `/api/voice-briefing` optional ElevenLabs endpoint
- `/api/demo-seed` optional demo seed helper

## Data model

Create a Supabase SQL file at `supabase/schema.sql`.

### children

- id uuid primary key
- parent_name text
- child_name text not null
- child_age int
- school_name text
- school_website_url text
- created_at timestamp default now()

### ingested_messages

- id uuid primary key
- child_id uuid nullable
- source_type text
- subject text nullable
- sender text nullable
- raw_text text not null
- processed_at timestamp default now()
- confidence numeric nullable

Allowed source_type values:
- pasted_email
- newsletter
- lunch_menu
- forwarded_email
- demo

### events

- id uuid primary key
- child_id uuid nullable
- message_id uuid nullable
- title text not null
- date date nullable
- start_time text nullable
- end_time text nullable
- location text nullable
- category text
- description text nullable
- confidence numeric nullable
- created_at timestamp default now()

Example categories:
- PE
- trip
- club
- lunch
- non_uniform
- inset
- deadline
- other

### tasks

- id uuid primary key
- child_id uuid nullable
- message_id uuid nullable
- title text not null
- due_date date nullable
- priority text
- status text
- cost text nullable
- notes text nullable
- confidence numeric nullable
- created_at timestamp default now()

Priority values:
- low
- medium
- high

Status values:
- open
- done

## AI extraction service

Create shared service:

`lib/extractSchoolComms.ts`

Input:
- rawText
- sourceType
- optional child profile
- current date
- school name

Output shape:

```ts
{
  summary: string;
  events: Array<{
    title: string;
    date: string | null;
    startTime: string | null;
    endTime: string | null;
    location: string | null;
    category: string;
    description: string | null;
    confidence: number;
  }>;
  tasks: Array<{
    title: string;
    dueDate: string | null;
    priority: "low" | "medium" | "high";
    cost: string | null;
    notes: string | null;
    confidence: number;
  }>;
  lunchMenu: Array<{
    date: string | null;
    meal: string;
    allergens: string | null;
    notes: string | null;
  }>;
  childNotes: Array<{
    childName: string | null;
    note: string;
  }>;
  warnings: string[];
  overallConfidence: number;
}
```

Rules:
- Use Zod validation.
- Resolve relative dates, such as "next Friday", from the current date.
- If a date cannot be inferred, return null and add a warning.
- If a child name is missing, use the active child profile where sensible.
- Never invent facts, costs, times or school policies.
- Prefer null plus warning over guessing.

## UI requirements

Keep the UI clean, dark and demo-friendly.

Dashboard sections:
- summary card: "Your school week at a glance"
- weekly calendar with next 7 days
- parent action list
- lunch menu
- recent sources collapsed by default

Add-message page:
- sample tabs for trip email, PE reminder, newsletter and lunch menu
- textarea for pasted school message or lunch menu text
- "Process message" button
- "Run test forwarded email" button
- return to dashboard after successful processing

Calendar:
- show one card per day
- group events by day
- show event category chips

Tasks:
- show open tasks first
- include priority badge
- include due date
- include cost where present
- allow marking task as done

Forwarding setup:
Show instructions:
1. Open Gmail settings.
2. Go to Filters and Blocked Addresses.
3. Create a filter for the school sender/domain.
4. Choose forward to your SchoolRun OS address.
5. Confirm forwarding.
6. Send a test email.

Show demo forwarding address:
`family-demo@schoolrun-os.app`

Add button:
"Run test forwarded email"

The button must POST a fake forwarded email payload to `/api/inbound-email`.

## Demo content

Use fake data only.

Child:
- Sam

School:
- Oakfield Primary

Include:
1. Trip email with date, payment deadline, cost and packed lunch requirement.
2. PE or non-uniform reminder with a specific day.
3. Newsletter with INSET day, club deadline and cake sale.
4. Lunch menu with meals and allergen notes.

## Security and privacy

- Do not use real child or school data.
- Add visible copy: "For this demo, use fake or redacted school messages."
- Never expose API keys to the browser.
- Store secrets in environment variables.
- Validate API inputs with Zod.
- Limit raw text input to 12,000 characters.
- Return safe user-facing errors.
- Do not log full raw school messages in production.
- Add simple in-memory rate limiting for demo API endpoints.
- Sanitize rendered text.
- Do not use unsafe HTML.

## Environment variables

- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- AI_GATEWAY_API_KEY or available model provider key
- ELEVENLABS_API_KEY
- ELEVENLABS_VOICE_ID

If Supabase vars are missing:
- run in local demo mode using in-memory state
- seed the dashboard with fake Oakfield Primary sample data
- do not crash

If ElevenLabs vars are missing:
- hide or disable voice briefing
- do not crash

## Build order

1. App shell and onboarding.
2. In-memory dashboard.
3. Extraction service and `/api/extract`.
4. Calendar and task rendering.
5. Fake forwarded email endpoint.
6. Forwarding setup page.
7. Supabase schema and persistence.
8. ElevenLabs voice briefing if time allows.
9. README and demo script.
10. Build check.

## Required repo files

- `README.md`
- `DEMO_SCRIPT.md`
- `supabase/schema.sql`
- `.env.example`
- working Next.js app files

## 90-second demo script outline

Opening:
"Parents do not need another inbox. They need the actions hidden inside school messages."

Show:
- child setup
- dashboard sample week
- add-message paste flow
- extracted calendar event
- extracted parent task
- forwarding setup page
- test forwarded email
- updated weekly calendar
- optional voice briefing

Closing:
"SchoolRun OS turns school emails, newsletters and menus into a clear weekly family plan."

## Acceptance criteria

- App runs locally with `npm run dev`
- App builds with `npm run build`
- User can create a child profile
- User can paste a fake school message
- Extraction produces structured events and tasks
- Dashboard displays weekly calendar, action list, lunch menu and collapsed recent sources
- Test forwarded email uses the same processing path
- App does not crash without Supabase or ElevenLabs keys
- README explains setup and deployment
- No real personal data is included
