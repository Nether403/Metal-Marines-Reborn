# Metal Marines 2026 — Campaign Theater Meta-Map

ChatPRD: https://app.chatprd.ai/chat/43870214-6310-4926-93d5-3613834266b0?doc=6876b315-f6f4-4485-8c54-c4d6fb2eb2b9

## Goal

Give players a 2026 remake fantasy of commanding a Pacific theater war, not just picking mission cards. Combat stays the existing Canvas RTS; the meta-map is the strategic layer that sells campaign progression.

## v1 acceptance

1. Home **NEW CAMPAIGN** opens `/campaign` Theater map.
2. Mission 1 Available; later missions follow existing unlock rules.
3. Cleared = Secured, locked = Classified.
4. Selecting a node launches existing Play briefing flow.
5. Theater reads as military/command UI (ocean backdrop, sector nodes, intel panel).

## Implementation notes

- Page: `artifacts/metal-marines/src/pages/CampaignTheater.tsx`
- Node layout: `src/data/theater.ts`
- Backdrop: `public/campaign/theater.jpg`
- List fallback remains at `/missions`
