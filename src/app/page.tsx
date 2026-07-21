"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, type QueueItem } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function StatusBadge({ status }: { status: QueueItem["status"] }) {
  const styles = {
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    done: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    error: "bg-red-500/15 text-red-400 border-red-500/30",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export default function Home() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState("");
  const [mfr, setMfr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | QueueItem["status"]>("all");

  const fetchQueue = useCallback(async () => {
    const { data, error } = await supabase
      .from("product_queue")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch error:", error);
      return;
    }

    setQueue(data as QueueItem[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("product_queue_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "product_queue",
        },
        () => {
          fetchQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchQueue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedBrand = brand.trim();
    const trimmedMfr = mfr.trim();
    if (!trimmedBrand || !trimmedMfr) return;

    // Client-side duplicate check
    const exists = queue.some(
      (item) => item.mfr.toLowerCase() === trimmedMfr.toLowerCase()
    );
    if (exists) {
      setError(`MFR "${trimmedMfr}" already exists in the queue.`);
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: insertError } = await supabase
      .from("product_queue")
      .insert({ brand: trimmedBrand, mfr: trimmedMfr });

    if (insertError) {
      if (insertError.code === "23505") {
        setError(`MFR "${trimmedMfr}" already exists in the queue.`);
      } else {
        setError(insertError.message);
      }
    } else {
      setBrand("");
      setMfr("");
      await fetchQueue();
    }

    setSubmitting(false);
  };

  const filtered =
    filter === "all"
      ? queue
      : queue.filter((item) => item.status === filter);

  const counts = {
    all: queue.length,
    pending: queue.filter((i) => i.status === "pending").length,
    done: queue.filter((i) => i.status === "done").length,
    error: queue.filter((i) => i.status === "error").length,
  };

  return (
    <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 py-6 sm:py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <img src="/logo.svg" alt="Product Queue" className="h-8 w-auto" />
        </div>
        <p className="text-muted-foreground mt-2 text-sm">
          Add products for the researcher to fetch from B&H
        </p>
      </div>

      {/* Add Form */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col sm:flex-row gap-3 mb-8"
      >
        <Input
          placeholder="Brand (e.g. Sony)"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          required
          className="flex-1 bg-secondary/50 border-white/10 placeholder:text-muted-foreground/60"
        />
        <Input
          placeholder="MFR number (e.g. ILCE-7M4/B)"
          value={mfr}
          onChange={(e) => setMfr(e.target.value)}
          required
          className="flex-1 bg-secondary/50 border-white/10 placeholder:text-muted-foreground/60 font-mono text-sm"
        />
        <Button
          type="submit"
          disabled={submitting || !brand.trim() || !mfr.trim()}
          className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold sm:w-auto"
        >
          {submitting ? "Adding..." : "Add"}
        </Button>
      </form>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {(["all", "pending", "done", "error"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              filter === f
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="ml-1.5 text-xs opacity-60">{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* Queue List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <div className="animate-pulse">Loading queue...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <svg
            className="w-12 h-12 mb-3 opacity-30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <p className="text-sm">
            {filter === "all"
              ? "Queue is empty. Add a product above."
              : `No ${filter} products.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Desktop table header */}
          <div className="hidden sm:grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <span>Brand</span>
            <span>MFR</span>
            <span>Status</span>
            <span className="text-right">Added</span>
          </div>

          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-card border border-white/[0.06] rounded-xl px-4 py-3.5 hover:border-white/10 transition-colors sm:grid sm:grid-cols-[1fr_1fr_auto_auto] sm:gap-4 sm:items-center"
            >
              {/* Mobile layout */}
              <div className="sm:hidden space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">{item.brand}</span>
                  <StatusBadge status={item.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono text-muted-foreground">
                    {item.mfr}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>

              {/* Desktop layout */}
              <span className="hidden sm:block font-medium text-white">
                {item.brand}
              </span>
              <span className="hidden sm:block text-sm font-mono text-muted-foreground">
                {item.mfr}
              </span>
              <div className="hidden sm:block">
                <StatusBadge status={item.status} />
              </div>
              <span className="hidden sm:block text-xs text-muted-foreground text-right whitespace-nowrap">
                {new Date(item.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
