/**
 * Integration test for happy path workflow
 * 
 * Tests the complete flow:
 * 1. Create escrow (PROPOSED)
 * 2. Buyer funds escrow (FUNDED)
 * 3. Seller releases escrow (RELEASED)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEscrow, applyAction } from "@/domain/escrow";
import { escrowStore } from "@/storage/escrow-store";
import { EscrowState, EscrowAction, UserRole } from "@/domain/escrow-state";

describe("Escrow Integration - Happy Path", () => {
  beforeEach(() => {
    escrowStore.clear();
  });

  it("should complete full workflow: PROPOSED -> FUNDED -> RELEASED (Seller release)", () => {
    // Step 1: Create escrow
    const { escrow: initialEscrow, event: createdEvent } = createEscrow(
      "test-escrow-1",
      "buyer-123",
      "seller-456",
      5000,
      "Purchase of goods"
    );

    expect(initialEscrow.currentState).toBe(EscrowState.PROPOSED);
    expect(createdEvent.type).toBe("ESCROW_CREATED");

    // Store the escrow
    escrowStore.create(initialEscrow, createdEvent);

    // Step 2: Buyer funds the escrow
    const fundResult = applyAction(
      initialEscrow,
      EscrowAction.FUND,
      "buyer-123",
      UserRole.BUYER
    );

    expect(fundResult.success).toBe(true);
    expect(fundResult.newEscrow?.currentState).toBe(EscrowState.FUNDED);
    expect(fundResult.event).toBeDefined();

    // Update store
    escrowStore.update(fundResult.newEscrow!, fundResult.event!);

    // Step 3: Seller releases the escrow
    const releaseResult = applyAction(
      fundResult.newEscrow!,
      EscrowAction.RELEASE,
      "seller-456",
      UserRole.SELLER
    );

    expect(releaseResult.success).toBe(true);
    expect(releaseResult.newEscrow?.currentState).toBe(EscrowState.RELEASED);
    expect(releaseResult.event).toBeDefined();

    // Update store
    escrowStore.update(releaseResult.newEscrow!, releaseResult.event!);

    // Verify final state
    const finalEscrow = escrowStore.getById("test-escrow-1");
    expect(finalEscrow).not.toBeNull();
    expect(finalEscrow?.currentState).toBe(EscrowState.RELEASED);
    expect(finalEscrow?.events.length).toBe(3); // Created, Funded, Released

    // Verify event history
    expect(finalEscrow?.events[0].type).toBe("ESCROW_CREATED");
    expect(finalEscrow?.events[1].type).toBe("STATE_CHANGED");
    expect(finalEscrow?.events[2].type).toBe("STATE_CHANGED");
  });

  it("should complete dispute resolution workflow", () => {
    // Create and fund escrow
    const { escrow: initialEscrow, event: createdEvent } = createEscrow(
      "test-escrow-2",
      "buyer-123",
      "seller-456",
      3000,
      "Service payment"
    );

    escrowStore.create(initialEscrow, createdEvent);

    // Fund
    const fundResult = applyAction(
      initialEscrow,
      EscrowAction.FUND,
      "buyer-123",
      UserRole.BUYER
    );
    escrowStore.update(fundResult.newEscrow!, fundResult.event!);

    // Dispute
    const disputeResult = applyAction(
      fundResult.newEscrow!,
      EscrowAction.DISPUTE,
      "buyer-123",
      UserRole.BUYER
    );
    escrowStore.update(disputeResult.newEscrow!, disputeResult.event!);

    // Admin resolves by releasing
    const resolveResult = applyAction(
      disputeResult.newEscrow!,
      EscrowAction.RESOLVE_DISPUTE_RELEASE,
      "admin-1",
      UserRole.ADMIN
    );
    escrowStore.update(resolveResult.newEscrow!, resolveResult.event!);

    // Verify
    const finalEscrow = escrowStore.getById("test-escrow-2");
    expect(finalEscrow?.currentState).toBe(EscrowState.RELEASED);
    expect(finalEscrow?.events.length).toBe(4);
  });

  it("Security Check: Cannot release un-funded escrow", () => {
    // 1. Create a new escrow (State: PROPOSED)
    const { escrow: initialEscrow } = createEscrow(
      "test-escrow-security",
      "buyer-123",
      "seller-456",
      1000,
      "Security Test"
    );

    // 2. Seller attempts to release funds immediately (should be impossible)
    const result = applyAction(
      initialEscrow,
      EscrowAction.RELEASE,
      "seller-456",
      UserRole.SELLER
    );

    // 3. Assert that the system REJECTED the action
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid transition/); // Ensure it failed for the right reason
    expect(result.newEscrow).toBeUndefined(); // State should NOT have changed
  });
});

