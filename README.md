# Escrow Workflow System

This project implements a workflow-driven escrow system between a Buyer and a Seller.
The focus is on correct workflow modeling, clear business rules, and testable state transitions.

## Overview

The system models an escrow lifecycle using a centralized state machine.
Each action results in an immutable event, creating a complete append-only history of what happened and when.

### Escrow states:

- **PROPOSED**
- **FUNDED**
- **RELEASED**
- **DISPUTED**
- **REFUNDED**

### Rules & Invariants

The following rules are enforced in the domain layer and covered by tests:

- Only the **Buyer** can fund an escrow
- Only the **Buyer** can raise a dispute
- Only the **Admin** can resolve disputes
- Invalid state transitions are rejected
- Once an escrow is **RELEASED** or **REFUNDED**, no further actions are allowed
- Every action creates an immutable event in an append-only history

## Architecture Overview

### Backend

- **TypeScript** is used across the codebase
- Business logic is completely separated from API routes
- All state transitions are centralized in a single domain state machine

**Key layers:**

- `src/domain/`
  - `escrow-state.ts`: defines valid states, actions, and transitions
  - `escrow.ts`: applies transitions and emits events
  - `events.ts`: event definitions and state reconstruction logic
- `src/storage/escrow-store.ts`
  - Stores current escrow state
  - Stores append-only event history (in-memory)

### Frontend

- Minimal UI built with **Next.js**
- Supports:
  - Creating an escrow
  - Viewing current state
  - Viewing full event history
  - Triggering valid actions based on selected role (Buyer / Seller / Admin)
- Design polish is intentionally minimal.

## Learning Requirement

**Chosen Concept: Event Sourcing**

I chose event sourcing because the assignment explicitly requires an immutable, append-only history of all actions.

### Why I chose it

I chose Event Sourcing because it fundamentally changes how we think about state management in financial systems. In traditional CRUD applications, we only store the current state. If a bug corrupts data or a dispute arises, there's no reliable way to reconstruct what actually happened.

Event Sourcing treats **every state change as an immutable fact**. Instead of updating a row with `status = 'FUNDED'`, we append an event: `FundedEvent(timestamp, amount, buyerId)`. The current state becomes a _projection_ of this history, which means:

- **Perfect auditability**: We can answer "who did what, when" with certainty
- **Time travel**: We can reconstruct the exact state at any point in history
- **Dispute resolution**: Critical for escrow systems where trust and verification are paramount

This pattern is used in production by Stripe (payment ledgers), banks (transaction logs), and event-driven architectures. I wanted to understand not just the theory, but the practical challenges of implementing it—like ensuring event ordering, handling state reconstruction, and maintaining consistency.

### What I learned

- How to model domain events that clearly describe what happened
- How to rebuild current state by replaying events in order
- Why append-only logs improve auditability and debugging
- How to keep state transitions deterministic and testable
- The trade-offs of in-memory vs persistent event storage

## Testing

The project includes automated tests using **Vitest**.

### Tests included

- Unit tests for all valid and invalid state transitions
- Tests proving invalid transitions are rejected
- Happy-path integration tests covering:
  - PROPOSED → FUNDED → RELEASED
  - Dispute and admin resolution flow

### Run tests with:

```bash
npm test
```

### Invalid Transition Test

The domain layer explicitly rejects invalid state transitions.
For example, the following unit test proves that attempting to
RELEASE an escrow directly from the PROPOSED state throws an error:

- `escrow-state.test.ts` – rejects PROPOSED → RELEASED transition

## Demo Steps

1. Create a new escrow (starts in **PROPOSED**)
2. Switch role to **Buyer**
3. Fund the escrow (**FUNDED**)
4. Release funds (**RELEASED**)
   - or raise a dispute (**DISPUTED**) and resolve it as **Admin**
5. View the full event history for each action

## Setup Instructions

```bash
npm install
npm run dev
npm test
```

App runs at: [http://localhost:3000](http://localhost:3000)

## Deployment

The application is deployed on Vercel.
**Live Demo:** [https://escrow-workflow-system.vercel.app/](https://escrow-workflow-system.vercel.app/)

The project is ready for review. If the link is unavailable, the project can be run locally using the setup steps above.

## Improvements

If extended further, I would:

- Replace in-memory storage with a database
- Add authentication and real user roles
- Persist events across restarts
- Improve error handling and UI feedback
