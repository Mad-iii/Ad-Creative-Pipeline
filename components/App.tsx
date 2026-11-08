"use client";

import { useSyncExternalStore } from "react";
import Workspace from "./Workspace";

const subscribe = () => () => {};

// Renders nothing on the server so localStorage state can load without a hydration mismatch.
export default function App() {
  const client = useSyncExternalStore(subscribe, () => true, () => false);
  if (!client) return <main className="mx-auto max-w-6xl px-6 py-16 text-muted">Loading…</main>;
  return <Workspace />;
}