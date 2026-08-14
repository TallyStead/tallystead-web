"use client";

import { Category, minorUnits } from "../lib/ledger";

export type SplitDraft = { key: number; category_id: string; amount: string };

export default function SplitEditor({ categories, direction, totalMinor, splits, setSplits }: { categories: Category[]; direction: "outflow" | "inflow"; totalMinor: number | null; splits: SplitDraft[]; setSplits: (value: SplitDraft[]) => void }) {
  const categoryType = direction === "inflow" ? "income" : "expense";
  const available = categories.filter((item) => !item.is_archived && item.category_type === categoryType);
  const allocated = splits.reduce((sum, item) => sum + (minorUnits(item.amount) ?? 0), 0);
  const remaining = totalMinor === null ? null : Math.abs(totalMinor) - allocated;
  function change(key: number, field: "category_id" | "amount", value: string) { setSplits(splits.map((item) => item.key === key ? { ...item, [field]: value } : item)); }
  function add() { setSplits([...splits, { key: Date.now(), category_id: "", amount: "" }]); }
  function remove(key: number) { setSplits(splits.filter((item) => item.key !== key)); }

  return <div className="split-editor">
    <div className="title-with-status"><b>Category allocation</b>{remaining !== null && <span className={`pill ${remaining === 0 ? "green" : "amber"}`}>{remaining === 0 ? "Fully allocated" : `${(remaining / 100).toFixed(2)} remaining`}</span>}</div>
    {splits.map((item, index) => <div className="split-line" key={item.key}><select aria-label={`Split ${index + 1} category`} value={item.category_id} onChange={(event) => change(item.key, "category_id", event.target.value)}><option value="">Uncategorized</option>{available.map((category) => <option key={category.category_id} value={category.category_id}>{category.name}</option>)}</select><input aria-label={`Split ${index + 1} amount`} inputMode="decimal" placeholder="0.00" value={item.amount} onChange={(event) => change(item.key, "amount", event.target.value)} />{splits.length > 1 && <button type="button" className="button compact" onClick={() => remove(item.key)}>Remove</button>}</div>)}
    <button type="button" className="button compact split-add" onClick={add}>Add another category</button>
  </div>;
}
