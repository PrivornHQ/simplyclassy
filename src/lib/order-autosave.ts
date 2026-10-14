import type { OrderSnapshot, UpdateOrderInput } from "@/data/orders";

export type OrderChanges = Omit<UpdateOrderInput, "orderId">;

export type OrderSaveState = {
  changes: OrderChanges;
  phase: "saving" | "saved" | "error";
  error: string | null;
};

type SaveEntry = {
  changes: OrderChanges;
  pending: OrderChanges;
  error: string | null;
  running: Promise<void> | null;
};

export function createOrderAutosave({
  save,
  onSaved,
  onStateChange,
  onError,
}: {
  save: (input: UpdateOrderInput) => Promise<OrderSnapshot>;
  onSaved: (order: OrderSnapshot) => void;
  onStateChange: (orderId: string, state: OrderSaveState) => void;
  onError: (message: string) => void;
}) {
  const entries = new Map<string, SaveEntry>();
  const hasChanges = (changes: OrderChanges) => Object.keys(changes).length > 0;

  const publish = (id: string, entry: SaveEntry) => {
    onStateChange(id, {
      changes: { ...entry.changes },
      phase: entry.error
        ? "error"
        : entry.running || hasChanges(entry.pending)
          ? "saving"
          : "saved",
      error: entry.error,
    });
  };

  async function drain(id: string, entry: SaveEntry) {
    while (hasChanges(entry.pending) && entries.get(id) === entry) {
      const patch = entry.pending;
      entry.pending = {};
      try {
        const order = await save({ orderId: id, ...patch });
        if (entries.get(id) !== entry) return;
        onSaved(order);
        for (const key of Object.keys(patch) as (keyof OrderChanges)[]) {
          if (entry.changes[key] === patch[key]) delete entry.changes[key];
        }
      } catch (error) {
        if (entries.get(id) !== entry) return;
        entry.pending = { ...patch, ...entry.pending };
        entry.error =
          error instanceof Error ? error.message : "Couldn't save this order. Please retry.";
        onError(entry.error);
        return;
      }
    }
  }

  function start(id: string, entry: SaveEntry) {
    if (entry.running) return;
    entry.error = null;
    entry.running = drain(id, entry).finally(() => {
      entry.running = null;
      if (entries.get(id) === entry) publish(id, entry);
    });
    publish(id, entry);
  }

  return {
    change(id: string, changes: OrderChanges) {
      if (!hasChanges(changes)) return;
      let entry = entries.get(id);
      if (!entry) {
        entry = { changes: {}, pending: {}, error: null, running: null };
        entries.set(id, entry);
      }
      entry.changes = { ...entry.changes, ...changes };
      entry.pending = { ...entry.pending, ...changes };
      entry.error = null;
      start(id, entry);
      publish(id, entry);
    },
    retry(id: string) {
      const entry = entries.get(id);
      if (entry && hasChanges(entry.pending)) start(id, entry);
    },
    async flush() {
      // Keep waiting if another field edit starts a request while earlier requests complete.
      let running = [...entries.values()].flatMap((entry) =>
        entry.running ? [entry.running] : [],
      );
      while (running.length > 0) {
        await Promise.all(running);
        running = [...entries.values()].flatMap((entry) => (entry.running ? [entry.running] : []));
      }
      return ![...entries.values()].some((entry) => hasChanges(entry.pending));
    },
    hasPendingChanges() {
      return [...entries.values()].some(
        (entry) => entry.running !== null || hasChanges(entry.pending),
      );
    },
    forget(ids: string[]) {
      for (const id of ids) entries.delete(id);
    },
  };
}
