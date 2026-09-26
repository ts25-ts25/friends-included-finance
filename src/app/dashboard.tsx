"use client";

import { useMemo, useState } from "react";
import { assertSplit, commissionForSale, euros, type Person, type Split } from "@/lib/finance";
import "./dashboard.css";

type Role = "Svetlana de Monte Carlo" | "Richard Darling" | "Anastasia Ferrari" | "Jean-Claude Berzins" | "Kevin von Whatever";
const roles: Role[] = ["Svetlana de Monte Carlo", "Richard Darling", "Anastasia Ferrari", "Jean-Claude Berzins", "Kevin von Whatever"];
const people: Person[] = ["Richard", "Anastasia", "Jean-Claude"];

export function Dashboard() {
  const [role, setRole] = useState<Role>("Svetlana de Monte Carlo");
  const [amount, setAmount] = useState("1000");
  const [split, setSplit] = useState<Split>({ Richard: 50, Anastasia: 30, "Jean-Claude": 20 });
  const [message, setMessage] = useState("Choose a demonstration role to begin.");
  const calculation = useMemo(() => {
    try { return commissionForSale(Number(amount), split); } catch { return null; }
  }, [amount, split]);

  const checkSale = () => {
    if (role === "Kevin von Whatever") return setMessage("Denied: Kevin may submit expenses, not sales.");
    if (role === "Svetlana de Monte Carlo") return setMessage("Svetlana does not make routine sales entries.");
    try { assertSplit(split); setMessage("Ready to save as Pending approval. The connected version will store this in Supabase."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Please correct the commission split."); }
  };

  return <main className="shell">
    <header>
      <p className="eyebrow">Friends Included Ltd</p>
      <h1>Finance control room</h1>
      <p className="subtitle">Wedding Guests for Hire - Day 4 homework</p>
    </header>

    <section className="rolebar" aria-label="Demonstration role selector">
      <label htmlFor="role">Demonstration role</label>
      <select id="role" value={role} onChange={(event) => setRole(event.target.value as Role)}>
        {roles.map((item) => <option key={item}>{item}</option>)}
      </select>
      <span>{role === "Svetlana de Monte Carlo" ? "Manager controls available" : "Only your permitted actions are available"}</span>
    </section>

    <section className="grid">
      <article className="panel">
        <h2>Enter a sale</h2>
        <p className="muted">All sales start pending and count only after manager approval.</p>
        <label>Sale amount in euros<input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <h3>Proposed commission split</h3>
        <div className="split-grid">
          {people.map((person) => <label key={person}>{person}<input type="number" min="0" max="100" value={split[person]} onChange={(event) => setSplit({ ...split, [person]: Number(event.target.value) })} /></label>)}
        </div>
        <button onClick={checkSale}>Validate sale entry</button>
        <p className="notice" role="status">{message}</p>
      </article>

      <article className="panel calculation">
        <h2>Commission preview</h2>
        {calculation ? <>
          <strong>{euros(calculation.pool)} total commission pool</strong>
          <dl>{people.map((person) => <div key={person}><dt>{person}</dt><dd>{split[person]}% - {euros(calculation.amounts[person])}</dd></div>)}</dl>
          <p className="muted">Preview only. Commission is earned only when Svetlana approves the sale.</p>
        </> : <p className="notice">Enter a positive amount and a split totalling 100%.</p>}
      </article>
    </section>

    <section className="grid results">
      <article className="panel"><h2>Project A</h2><p className="metric">€0.00</p><p className="muted">Approved income, commissions and allocated expenses will appear here.</p></article>
      <article className="panel"><h2>Project B</h2><p className="metric">€0.00</p><p className="muted">Approved income, commissions and allocated expenses will appear here.</p></article>
      <article className="panel"><h2>Company result</h2><p className="metric">€0.00</p><p className="muted">Includes all recorded expenses, including unallocated ones.</p></article>
    </section>
  </main>;
}
