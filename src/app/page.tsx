"use client";

import { useState, useEffect } from "react";
import { EscrowState, EscrowAction, UserRole } from "@/domain/escrow-state";
import { EscrowEvent, EventType, EscrowCreatedEvent } from "@/domain/events";

interface Escrow {
  id: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  description: string;
  currentState: EscrowState;
  createdAt: string;
  updatedAt: string;
}

export default function Home() {
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [selectedEscrow, setSelectedEscrow] = useState<{
    escrow: Escrow;
    events: EscrowEvent[];
  } | null>(null);
  const [currentUser, setCurrentUser] = useState<UserRole>(UserRole.BUYER);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    buyerId: "",
    sellerId: "",
    amount: "",
    description: "",
  });

  // Load escrows (in a real app, this would be a proper API call)
  const loadEscrows = async () => {
    // For demo purposes, we'll just show the selected escrow
    // In production, you'd have a list endpoint
  };

  const handleCreateEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/escrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerId: formData.buyerId,
          sellerId: formData.sellerId,
          amount: parseFloat(formData.amount),
          description: formData.description,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.escrow) {
        // Clear form
        setFormData({ buyerId: "", sellerId: "", amount: "", description: "" });
        setShowCreateForm(false);

        // Immediately add to escrows list
        const newEscrow: Escrow = {
          id: data.escrow.id,
          buyerId: data.escrow.buyerId,
          sellerId: data.escrow.sellerId,
          amount: data.escrow.amount,
          description: data.escrow.description,
          currentState: data.escrow.currentState,
          createdAt: data.escrow.createdAt,
          updatedAt: data.escrow.updatedAt,
        };

        setEscrows((prev) => {
          if (!prev.find((e) => e.id === newEscrow.id)) {
            return [...prev, newEscrow];
          }
          return prev;
        });

        // Set as selected immediately with basic info and initial event
        // Create a basic event from the creation
        const initialEvent: EscrowCreatedEvent = {
          id: `evt_${Date.now()}`,
          type: EventType.ESCROW_CREATED,
          timestamp: new Date(data.escrow.createdAt),
          escrowId: newEscrow.id,
          buyerId: newEscrow.buyerId,
          sellerId: newEscrow.sellerId,
          amount: newEscrow.amount,
          description: newEscrow.description,
        };

        setSelectedEscrow({
          escrow: newEscrow,
          events: [initialEvent], // Start with creation event
        });

        // Try to load full details, but don't fail if it's not found
        // (in-memory store might not persist between requests in dev mode)
        loadEscrow(data.escrow.id).catch(() => {
          // Silently fail - escrow is already displayed with basic info
        });
      } else {
        alert(`Error: ${data.error || "Failed to create escrow"}`);
      }
    } catch (error) {
      console.error("Create escrow error:", error);
      alert("Failed to create escrow. Please check the console for details.");
    } finally {
      setLoading(false);
    }
  };

  const loadEscrow = async (id: string) => {
    try {
      const response = await fetch(`/api/escrow/${id}`);

      if (!response.ok) {
        // 404 is expected sometimes with in-memory storage
        if (response.status === 404) {
          return; // Silently return - escrow might not be in store yet
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.escrow) {
        const escrow: Escrow = {
          id: data.escrow.id,
          buyerId: data.escrow.buyerId,
          sellerId: data.escrow.sellerId,
          amount: data.escrow.amount,
          description: data.escrow.description,
          currentState: data.escrow.currentState,
          createdAt: data.escrow.createdAt,
          updatedAt: data.escrow.updatedAt,
        };

        setSelectedEscrow({
          escrow,
          events: data.events || [],
        });

        // Add to escrows list if not already there
        setEscrows((prev) => {
          if (!prev.find((e) => e.id === escrow.id)) {
            return [...prev, escrow];
          }
          return prev;
        });
      }
    } catch (error) {
      // Silently fail - escrow is already displayed
      // This is expected with in-memory storage in some cases
    }
  };

  const handleAction = async (action: EscrowAction) => {
    if (!selectedEscrow) return;

    // Check if action is allowed before making the request
    if (!isActionAllowed(action)) {
      alert(
        `Error: User role ${currentUser} cannot perform action ${formatActionName(
          action
        )}`
      );
      return;
    }

    const perform = async () => {
      const response = await fetch(
        `/api/escrow/${selectedEscrow.escrow.id}/actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            performedBy:
              currentUser === UserRole.BUYER
                ? selectedEscrow.escrow.buyerId
                : currentUser === UserRole.SELLER
                ? selectedEscrow.escrow.sellerId
                : "admin",
            userRole: currentUser,
          }),
        }
      );
      return response;
    };

    setLoading(true);
    try {
      let response = await perform();

      // If the store wasn't ready yet (e.g., first action after create), retry once after reloading escrow
      if (response.status === 404) {
        await new Promise((r) => setTimeout(r, 150));
        await loadEscrow(selectedEscrow.escrow.id);
        response = await perform();
      }

      const data = await response.json();
      if (data.success) {
        await loadEscrow(selectedEscrow.escrow.id);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert("Failed to perform action");
    } finally {
      setLoading(false);
    }
  };

  const getAvailableActions = (): EscrowAction[] => {
    if (!selectedEscrow) return [];
    const state = selectedEscrow.escrow.currentState;
    const role = currentUser;

    const actions: EscrowAction[] = [];

    if (state === EscrowState.PROPOSED && role === UserRole.BUYER) {
      actions.push(EscrowAction.FUND);
    }

    if (state === EscrowState.FUNDED) {
      if (role === UserRole.SELLER) {
        actions.push(EscrowAction.RELEASE);
      }
      if (role === UserRole.BUYER) {
        actions.push(EscrowAction.DISPUTE);
      }
    }

    if (state === EscrowState.DISPUTED && role === UserRole.ADMIN) {
      actions.push(EscrowAction.RESOLVE_DISPUTE_RELEASE);
      actions.push(EscrowAction.RESOLVE_DISPUTE_REFUND);
    }

    return actions;
  };

  const getAllPossibleActions = (): EscrowAction[] => {
    if (!selectedEscrow) return [];
    const state = selectedEscrow.escrow.currentState;

    // Get all possible actions for this state (regardless of role)
    const allActions: EscrowAction[] = [];

    if (state === EscrowState.PROPOSED) {
      allActions.push(EscrowAction.FUND);
    }

    if (state === EscrowState.FUNDED) {
      allActions.push(EscrowAction.RELEASE, EscrowAction.DISPUTE);
    }

    if (state === EscrowState.DISPUTED) {
      allActions.push(
        EscrowAction.RESOLVE_DISPUTE_RELEASE,
        EscrowAction.RESOLVE_DISPUTE_REFUND
      );
    }

    return allActions;
  };

  const isActionAllowed = (action: EscrowAction): boolean => {
    if (!selectedEscrow) return false;
    const state = selectedEscrow.escrow.currentState;
    const role = currentUser;

    // Check if state is terminal
    if (state === EscrowState.RELEASED || state === EscrowState.REFUNDED) {
      return false;
    }

    // Check permissions
    const permissions: Record<EscrowAction, UserRole[]> = {
      [EscrowAction.FUND]: [UserRole.BUYER],
      [EscrowAction.RELEASE]: [UserRole.SELLER],
      [EscrowAction.DISPUTE]: [UserRole.BUYER],
      [EscrowAction.RESOLVE_DISPUTE_RELEASE]: [UserRole.ADMIN],
      [EscrowAction.RESOLVE_DISPUTE_REFUND]: [UserRole.ADMIN],
      [EscrowAction.REFUND]: [], // Not used - refund only via dispute resolution
    };

    const allowedRoles = permissions[action] || [];
    return allowedRoles.includes(role);
  };

  const getStateColor = (state: EscrowState): string => {
    switch (state) {
      case EscrowState.PROPOSED:
        return "bg-amber-50 text-amber-700 border-amber-200";
      case EscrowState.FUNDED:
        return "bg-blue-50 text-blue-700 border-blue-200";
      case EscrowState.RELEASED:
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case EscrowState.DISPUTED:
        return "bg-rose-50 text-rose-700 border-rose-200";
      case EscrowState.REFUNDED:
        return "bg-slate-50 text-slate-700 border-slate-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const getStateIcon = (state: EscrowState): string => {
    switch (state) {
      case EscrowState.PROPOSED:
        return "⏳";
      case EscrowState.FUNDED:
        return "💰";
      case EscrowState.RELEASED:
        return "✅";
      case EscrowState.DISPUTED:
        return "⚠️";
      case EscrowState.REFUNDED:
        return "↩️";
      default:
        return "📋";
    }
  };

  const formatActionName = (action: EscrowAction): string => {
    return action
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-10 lg:px-12 xl:px-16 py-8 lg:py-14 xl:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-12 items-start">
          {/* LEFT: Escrow Workflow System */}
          <div className="space-y-8 lg:col-span-8">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                  🔒
                </div>
                <div>
                  <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                    Escrow Workflow System
                  </h1>
                  <p className="text-gray-600">
                    Manage secure transactions between buyers and sellers
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowCreateForm((v) => !v)}
                  className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  aria-expanded={showCreateForm}
                >
                  {showCreateForm ? "Close" : "+ New Escrow"}
                </button>
              </div>
            </div>

            {/* User Role Selector */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-8">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Viewing As
                </label>
              </div>
              <div className="p-2 flex gap-2">
                {[UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN].map(
                  (role) => (
                    <button
                      key={role}
                      onClick={() => setCurrentUser(role)}
                      className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                        currentUser === role
                          ? "bg-blue-600 text-white shadow-md transform scale-[1.02]"
                          : "bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent hover:border-gray-200"
                      }`}
                    >
                      <span>
                        {role === UserRole.BUYER
                          ? "🛍️"
                          : role === UserRole.SELLER
                          ? "🏪"
                          : "⚖️"}
                      </span>
                      {role.charAt(0) + role.slice(1).toLowerCase()}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Create Escrow Form */}
            {showCreateForm && (
              <div className="p-8 bg-white rounded-2xl border border-gray-200 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300 mb-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      Create New Escrow
                    </h2>
                    <p className="text-gray-500 mt-1">
                      Initialize a secure transaction
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <form onSubmit={handleCreateEscrow} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">
                        Buyer ID
                      </label>
                      <input
                        type="text"
                        value={formData.buyerId}
                        onChange={(e) =>
                          setFormData({ ...formData, buyerId: e.target.value })
                        }
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                        placeholder="e.g., buyer_alice"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">
                        Seller ID
                      </label>
                      <input
                        type="text"
                        value={formData.sellerId}
                        onChange={(e) =>
                          setFormData({ ...formData, sellerId: e.target.value })
                        }
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                        placeholder="e.g., seller_bob"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">
                      Amount ($)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) =>
                          setFormData({ ...formData, amount: e.target.value })
                        }
                        className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-mono"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none resize-none"
                      placeholder="What is this transaction for?"
                      required
                    />
                  </div>

                  <div className="flex gap-4 pt-4 border-t border-gray-100">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-600/20"
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="animate-spin text-xl">◌</span>{" "}
                          Creating...
                        </span>
                      ) : (
                        "Create Escrow"
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="px-6 py-3 bg-white text-gray-700 font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Escrow List */}
            {escrows.length > 0 && !selectedEscrow && (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h2 className="text-lg font-bold text-gray-900">
                    Your Escrows
                  </h2>
                  <span className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-semibold text-gray-600">
                    Total: {escrows.length}
                  </span>
                </div>
                {escrows.map((escrow) => (
                  <button
                    key={escrow.id}
                    onClick={() => loadEscrow(escrow.id)}
                    className="w-full group text-left bg-white p-5 rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                          {escrow.id}
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500 font-medium">
                          {new Date(escrow.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-lg text-xs font-bold border ${getStateColor(
                          escrow.currentState
                        )}`}
                      >
                        {escrow.currentState}
                      </span>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                          {escrow.description}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            👤 Buyer: {escrow.buyerId}
                          </span>
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        ${escrow.amount.toLocaleString()}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Selected Escrow Details + Actions */}
            {selectedEscrow && (
              <div className="space-y-6">
                <button
                  onClick={() => setSelectedEscrow(null)}
                  className="text-sm font-semibold text-gray-500 hover:text-gray-900 flex items-center gap-2 transition-colors px-2"
                >
                  ← Back to List
                </button>

                <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
                  {/* Status Banner */}
                  <div
                    className={`px-8 py-6 border-b border-gray-100 bg-gradient-to-r ${
                      selectedEscrow.escrow.currentState ===
                      EscrowState.RELEASED
                        ? "from-emerald-50 to-teal-50"
                        : selectedEscrow.escrow.currentState ===
                          EscrowState.REFUNDED
                        ? "from-slate-50 to-gray-50"
                        : selectedEscrow.escrow.currentState ===
                          EscrowState.DISPUTED
                        ? "from-rose-50 to-orange-50"
                        : selectedEscrow.escrow.currentState ===
                          EscrowState.FUNDED
                        ? "from-blue-50 to-indigo-50"
                        : "from-amber-50 to-orange-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-5xl filter drop-shadow-sm">
                          {getStateIcon(selectedEscrow.escrow.currentState)}
                        </span>
                        <div>
                          <div className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-1">
                            Current Status
                          </div>
                          <div
                            className={`text-2xl font-extrabold ${
                              selectedEscrow.escrow.currentState ===
                              EscrowState.PROPOSED
                                ? "text-amber-600"
                                : selectedEscrow.escrow.currentState ===
                                  EscrowState.FUNDED
                                ? "text-blue-600"
                                : selectedEscrow.escrow.currentState ===
                                  EscrowState.DISPUTED
                                ? "text-rose-600"
                                : "text-gray-800"
                            }`}
                          >
                            {selectedEscrow.escrow.currentState}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-1">
                          Amount
                        </div>
                        <div className="text-4xl font-black text-gray-900 tracking-tight">
                          ${selectedEscrow.escrow.amount.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 bg-white">
                    <div className="space-y-6">
                      <div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                          Transaction Details
                        </div>
                        <p className="text-lg text-gray-900 leading-relaxed font-medium">
                          {selectedEscrow.escrow.description}
                        </p>
                      </div>
                      <div className="pt-6 border-t border-gray-100">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                          Parties Involved
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                            <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                              B
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 font-semibold">
                                Buyer
                              </div>
                              <div className="text-sm font-bold text-gray-900">
                                {selectedEscrow.escrow.buyerId}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                            <div className="h-8 w-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xs">
                              S
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 font-semibold">
                                Seller
                              </div>
                              <div className="text-sm font-bold text-gray-900">
                                {selectedEscrow.escrow.sellerId}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions Panel */}
                    {/* Actions Panel */}
                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200 flex flex-col justify-center">
                      <div className="text-center mb-6">
                        <h3 className="font-bold text-gray-900">
                          Available Actions
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Role:{" "}
                          <span className="font-bold text-blue-600 uppercase">
                            {currentUser}
                          </span>
                        </p>
                      </div>

                      {getAvailableActions().length > 0 ? (
                        <div className="space-y-3">
                          {getAvailableActions().map((action) => (
                            <button
                              key={action}
                              onClick={() => handleAction(action)}
                              disabled={loading}
                              className={`w-full py-4 px-6 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:shadow-md transition-all duration-200 flex items-center justify-center gap-3
                                ${
                                  action.includes("REFUND") ||
                                  action === EscrowAction.DISPUTE
                                    ? "bg-rose-600 text-white hover:bg-rose-700 shadow-rose-600/20"
                                    : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20"
                                }
                              `}
                            >
                              <span>
                                {action === EscrowAction.FUND
                                  ? "💸 Pay Now"
                                  : action === EscrowAction.RELEASE
                                  ? "✅ Release Funds"
                                  : action === EscrowAction.DISPUTE
                                  ? "🚨 Raise Dispute"
                                  : action ===
                                    EscrowAction.RESOLVE_DISPUTE_REFUND
                                  ? "↩️ Refund Buyer"
                                  : "📢 Release to Seller"}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 px-4">
                          <div className="text-4xl mb-3 grayscale opacity-30">
                            {selectedEscrow.escrow.currentState ===
                            EscrowState.RELEASED
                              ? "🤝"
                              : selectedEscrow.escrow.currentState ===
                                EscrowState.REFUNDED
                              ? "↩️"
                              : "✋"}
                          </div>
                          <p className="text-gray-600 font-medium">
                            No actions available
                          </p>
                          <p className="text-xs text-gray-400 mt-2 max-w-[200px] mx-auto">
                            {selectedEscrow.escrow.currentState ===
                              EscrowState.RELEASED ||
                            selectedEscrow.escrow.currentState ===
                              EscrowState.REFUNDED
                              ? "This transaction is complete."
                              : "Switch user role to perform authorized actions for this state."}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!selectedEscrow && escrows.length === 0 && !loading && (
              <div className="p-16 bg-white rounded-3xl shadow-xl border-dashed border-2 border-gray-200 text-center">
                <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
                  🔒
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  No Escrows Yet
                </h3>
                <p className="text-gray-500 mb-8 max-w-sm mx-auto">
                  Create your first escrow to get started with secure,
                  transparent transactions
                </p>
                {!showCreateForm && (
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/20 hover:shadow-xl hover:-translate-y-0.5 transition-all"
                  >
                    + Create First Escrow
                  </button>
                )}
              </div>
            )}

            {/* Loading State */}
            {loading && !selectedEscrow && (
              <div className="p-12 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
                <p className="mt-4 text-gray-500 font-medium">Processing...</p>
              </div>
            )}
          </div>

          {/* RIGHT: Event History */}
          <div className="space-y-8 lg:sticky lg:top-10 lg:col-span-4 max-h-[calc(100vh-4rem)] overflow-y-auto pr-2">
            {selectedEscrow ? (
              <div className="p-6 bg-white rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-gray-900 text-xl flex items-center gap-2">
                    <span className="text-2xl">📜</span> Event History
                  </h3>
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-semibold">
                    {selectedEscrow.events.length}{" "}
                    {selectedEscrow.events.length === 1 ? "event" : "events"}
                  </span>
                </div>
                <div className="space-y-4">
                  {selectedEscrow.events.map((event) => (
                    <div
                      key={event.id}
                      className="p-5 bg-gradient-to-r from-gray-50 via-blue-50/50 to-indigo-50/50 rounded-xl border-l-4 border-blue-500 shadow-md hover:shadow-lg transition-all duration-200"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">
                              {event.type === EventType.ESCROW_CREATED
                                ? "✨"
                                : "🔄"}
                            </span>
                            <span className="font-bold text-gray-900 text-lg">
                              {event.type === EventType.ESCROW_CREATED
                                ? "Escrow Created"
                                : "State Changed"}
                            </span>
                          </div>
                          {event.type === EventType.STATE_CHANGED && (
                            <div className="mb-3 flex items-center gap-3">
                              <span
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 ${getStateColor(
                                  event.fromState
                                )}`}
                              >
                                {event.fromState}
                              </span>
                              <span className="text-gray-400 text-lg">→</span>
                              <span
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 ${getStateColor(
                                  event.toState
                                )}`}
                              >
                                {event.toState}
                              </span>
                            </div>
                          )}
                          <div className="text-xs text-gray-500 mt-3 inline-flex items-center gap-2 bg-white/50 px-3 py-1.5 rounded-lg">
                            <span>🕐</span>
                            {new Date(event.timestamp).toLocaleString()}
                          </div>
                        </div>
                        {event.type === EventType.STATE_CHANGED && (
                          <div className="text-right bg-white/60 p-3 rounded-lg">
                            <div className="text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider">
                              Action
                            </div>
                            <div className="text-sm font-bold text-gray-900 mb-3">
                              {formatActionName(event.action)}
                            </div>
                            <div className="text-xs text-gray-600 space-y-1">
                              <div className="font-semibold">
                                {event.performedBy}
                              </div>
                              <div className="text-gray-500">
                                {event.userRole}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-6 bg-white rounded-2xl border border-gray-200 shadow-sm text-center text-gray-600">
                Select an escrow to see its event history
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
