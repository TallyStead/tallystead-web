export type DocumentItem = { document_id:string; kind:"receipt"|"invoice"|"statement"|"general"; filename:string; content_type:string; size_bytes:number; checksum_sha256:string; status:string; account_id:string|null; account_name:string|null; document_date:string|null; amount_minor:number|null; currency_code:string|null; payee:string|null; notes:string|null; has_thumbnail:boolean; linked_transaction_id:string|null; created_at:string; updated_at:string };
export type DocumentMatch = { match_id:string; transaction_id:string; transaction_date:string; account_name:string; payee:string|null; amount_minor:number; currency_code:string; method:string; confidence_percent:number; evidence:string; status:string; reviewed_at:string|null };
export type ReceiptLineItem = { description:string|null; quantity:number|null; unit_price_minor:number|null; total_minor:number|null; sku:string|null; category_hint:string|null };
export type ReceiptSuggestions = {
  schema_version?:string;
  merchant?:{name?:string|null;address?:string|null;phone?:string|null;tax_id?:string|null};
  transaction?:{date?:string|null;time?:string|null;timezone?:string|null;receipt_number?:string|null};
  amounts?:{subtotal_minor?:number|null;discount_minor?:number|null;tax_minor?:number|null;tip_minor?:number|null;total_minor?:number|null;currency_code?:string|null};
  payment?:{method?:string|null;card_last_four?:string|null};
  line_items?:ReceiptLineItem[];
  category_hint?:string|null;
  confidence?:{overall_percent?:number;field_percent?:Record<string,number>};
  validation?:{arithmetic_consistent?:boolean;warnings?:string[];review_required?:boolean};
  explanation?:string|null;
  [key:string]:unknown;
};
export type DocumentExtraction = { extraction_id:string; provider:string; model_version:string; status:string; suggestions:ReceiptSuggestions|null; confidence_percent:number|null; failure_detail:string|null; user_disposition:string; created_at:string; completed_at:string|null };
export type DocumentDetail = { document:DocumentItem; matches:DocumentMatch[]; extractions:DocumentExtraction[] };
