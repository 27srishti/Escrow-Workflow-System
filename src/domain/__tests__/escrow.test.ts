/**
 * Unit tests for escrow domain logic
 */

import { describe, it, expect } from "vitest";
import { createEscrow, applyAction } from "../escrow";
import { EscrowState, EscrowAction, UserRole } from "../escrow-state";

describe("Escrow Domain", () => {
  describe("createEscrow", () => {
    it("should create an escrow in PROPOSED state", () => {
      const { escrow, event } = createEscrow(
        "test-id",
        "buyer-1",
        "seller-1",
        1000,
        "Test escrow"
      );

      expect(escrow.id).toBe("test-id");
      expect(escrow.buyerId).toBe("buyer-1");
      expect(escrow.sellerId).toBe("seller-1");
      expect(escrow.amount).toBe(1000);
      expect(escrow.description).toBe("Test escrow");
      expect(escrow.currentState).toBe(EscrowState.PROPOSED);
      expect(event.type).toBe("ESCROW_CREATED");
    });
  });

  describe("applyAction", () => {
    it("should successfully apply a valid action", () => {
      const { escrow } = createEscrow(
        "test-id",
        "buyer-1",
        "seller-1",
        1000,
        "Test escrow"
      );

      const result = applyAction(
        escrow,
        EscrowAction.FUND,
        "buyer-1",
        UserRole.BUYER
      );

      expect(result.success).toBe(true);
      expect(result.newEscrow?.currentState).toBe(EscrowState.FUNDED);
      expect(result.event?.type).toBe("STATE_CHANGED");
    });

    it("should reject invalid action", () => {
      const { escrow } = createEscrow(
        "test-id",
        "buyer-1",
        "seller-1",
        1000,
        "Test escrow"
      );

      const result = applyAction(
        escrow,
        EscrowAction.RELEASE,
        "seller-1",
        UserRole.SELLER
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});




