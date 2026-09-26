export type Person = "Richard" | "Anastasia" | "Jean-Claude";
export type Split = Record<Person, number>;

export function assertSplit(split: Split) {
  const values = Object.values(split);
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
    throw new Error("Each commission share must be between 0% and 100%.");
  }
  if (Math.round(values.reduce((total, value) => total + value, 0) * 100) !== 10000) {
    throw new Error("Commission shares must total exactly 100%.");
  }
}

export function commissionForSale(amount: number, split: Split) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Sale amount must be greater than zero.");
  assertSplit(split);
  const poolCents = Math.round(amount * 10); // exactly 10%, in cents
  const order: Person[] = ["Richard", "Anastasia", "Jean-Claude"];
  const cents = Object.fromEntries(order.map((person) => [person, Math.floor(poolCents * split[person] / 100)])) as Record<Person, number>;
  const assigned = order.reduce((total, person) => total + cents[person], 0);
  const largest = [...order].sort((a, b) => split[b] - split[a] || order.indexOf(a) - order.indexOf(b))[0];
  cents[largest] += poolCents - assigned;
  return {
    pool: poolCents / 100,
    amounts: Object.fromEntries(order.map((person) => [person, cents[person] / 100])) as Record<Person, number>
  };
}

export function euros(value: number) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(value);
}
