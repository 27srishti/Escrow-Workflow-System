/**
 * GET /api/escrow/[id] - Get escrow with history
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { escrowStore } from "@/storage/escrow-store";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const escrow = escrowStore.getById(id);

    if (!escrow) {
      return NextResponse.json(
        { success: false, error: "Escrow not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      escrow: {
        id: escrow.id,
        buyerId: escrow.buyerId,
        sellerId: escrow.sellerId,
        amount: escrow.amount,
        description: escrow.description,
        currentState: escrow.currentState,
        createdAt: escrow.createdAt.toISOString(),
        updatedAt: escrow.updatedAt.toISOString(),
      },
      events: escrow.events.map((event) => ({
        ...event,
        timestamp: event.timestamp.toISOString(),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}




