export type Account = { account_id: string; name: string; account_type: string; currency_code: string; opening_balance_minor: number; balance_minor: number; include_in_planner: boolean; include_in_net_worth: boolean; ownership_scope: "household" | "business"; balance_nature: "asset" | "liability"; liquidity: "spendable" | "restricted" | "invested" | "non_liquid" | "liability"; tax_treatment: string; institution: string | null; masked_identifier: string | null; current_value_minor: number; valuation_as_of: string | null; is_archived: boolean };
export type Category = { category_id: string; name: string; category_type: "income" | "expense"; is_system_default: boolean; is_archived: boolean };
export type Merchant = { merchant_id: string; name: string; aliases: string[]; is_archived: boolean };
export type Split = { split_id: string; category_id: string; category_name: string; amount_minor: number; memo: string | null };
export type Transaction = { transaction_id: string; account_id: string; account_name: string; transaction_date: string; amount_minor: number; currency_code: string; status: string; payee: string | null; raw_payee: string | null; merchant_id: string | null; merchant_name: string | null; memo: string | null; source_type: string; source_reference: string | null; activity_type: string; transfer_id: string | null; reversal_of_transaction_id: string | null; corrected_from_transaction_id: string | null; reconciled_at: string | null; splits: Split[] };
export type NetWorthAccount = { account_id: string; name: string; account_type: string; ownership_scope: string; balance_nature: string; liquidity: string; value_minor: number; currency_code: string; valuation_as_of: string | null };
export type NetWorth = { as_of: string; currency_code: string; asset_total_minor: number; liability_total_minor: number; net_worth_minor: number; household_net_worth_minor: number; business_net_worth_minor: number; accounts: NetWorthAccount[] };
export type Revision = { revision_id: string; reason: string; before_snapshot: Record<string, unknown>; created_at: string };
export type TransactionDetail = { transaction: Transaction; revisions: Revision[] };
export type BalanceExplanation = { account_id: string; account_name: string; currency_code: string; as_of: string; include_pending: boolean; opening_balance_minor: number; activity_minor: number; balance_minor: number; included_transaction_ids: string[] };

export function minorUnits(value: string): number | null {
  const match = value.trim().match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const amount = Number(match[2]) * 100 + Number((match[3] ?? "").padEnd(2, "0"));
  return match[1] === "-" ? -amount : amount;
}

export function money(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount / 100);
}

export function today() { return new Date().toISOString().slice(0, 10); }
