# Project: bazaraki-cars

## Context

This is a personal tool (NOT a SaaS yet) for buying used cars in Cyprus.

Stack:
- Backend: Node.js + Express
- Frontend: React + Vite + TypeScript
- DB: SQLite (Drizzle ORM)
- Scraping: Playwright

Primary goal:
- Fast, practical UX for evaluating listings and making calls
- NOT scalability, NOT enterprise architecture

---

# Core Principles

- Keep everything SIMPLE
- Prefer readability over abstraction
- Avoid overengineering at all costs
- Optimize for speed of development
- This is a single-user tool

---

# ❌ What NOT to do

- No microservices
- No repository pattern
- No complex state managers unless necessary
- No premature optimization
- No generic abstractions “for future”

If unsure → choose the simplest solution.

---

# Backend Guidelines (Express)

## Structure

- Use simple route handlers
- Extract logic into `/services` only if reused
- No deep layering

Example:

/routes
/services
/db

---

## API Design

- REST, simple JSON
- No GraphQL
- No over-normalization

---

## Database (SQLite + Drizzle)

### Rules

- Prefer denormalization for UI speed
- Avoid heavy joins
- Store computed fields in `listings`:
  - score
  - recommendation
  - suggestedOffer

---

### Indexing (MANDATORY)

Always add indexes for:

- listings.status
- listings.price
- listings.brand + listings.model
- analyses.listingId

---

### JSON fields

Allowed:
- risks
- questions
- imageUrls

Do NOT over-normalize them into tables.

---

### Migrations

- Use drizzle-kit
- Never drop data
- Never recreate DB in production

---

# Frontend Guidelines (React)

## Principles

- UI-first, not architecture-first
- Keep components simple
- Avoid deep abstractions

---

## Component Structure

- Pages:
  - Dashboard
  - Listings
  - ListingDetails

- Components:
  - ListingTable
  - AnalysisCard
  - CallAssistant
  - NotesBox

---

## State Management

- Use TanStack Query for server state
- Local state via useState
- NO Redux / MobX

---

## Data Fetching

- Keep endpoints flat
- Avoid cascading requests
- Prefer 1 request per screen

---

## Code Splitting

- Use route-based splitting only
- Do NOT over-split components

Example:

const ListingsPage = lazy(() => import('./pages/Listings'))

---

## UI Rules

- Prioritize clarity over design
- Show important data immediately:
  - price
  - score
  - recommendation

---

# Call-First Workflow (CRITICAL)

The product is built around:

scrape → analyze → call → notes → follow-up

---

## Call Assistant MUST include:

- summary
- risks
- questions checklist
- negotiation tips
- target price

---

## After Call

- Save notes
- Generate WhatsApp message (copy only)
- NO WhatsApp integration

---

# Scraper Constraints

- Bazaraki has no API
- Selectors may break
- Must handle errors gracefully

DO NOT assume scraper is reliable.

---

# Deployment

- Single VPS
- SQLite file on disk (/data/bazaraki.db)
- No Docker required
- No cloud DB

---

# Performance

- Optimize DB reads first
- Avoid unnecessary re-renders
- Avoid N+1 requests

---

# When writing code

ALWAYS:

1. Choose the simplest solution
2. Avoid abstraction unless repeated 2+ times
3. Keep files small and readable
4. Think about UX, not just code

---

# If unsure

Ask:

"Is this necessary for a single-user tool?"

If NO → do not implement