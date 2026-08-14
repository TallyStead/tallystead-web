export type Citation={id:string;type:string;label:string;href:string};
export type StoredMessage={message_id:string;role:"user"|"assistant";content:string;citations:Citation[];provider:string|null;model_version:string|null;created_at:string};
export type Conversation={conversation_id:string;title:string;currency_code:string;ownership_scope:string;created_at:string;updated_at:string;messages?:StoredMessage[]};
export type SuggestionSplit={category_id:string;category_name:string;amount_minor:number};
export type CategorySuggestion={suggestion_id:string;transaction_id:string;transaction_date:string;payee:string|null;amount_minor:number;currency_code:string;provider:string;model_version:string;rule_version:string;confidence_percent:number;proposed_splits:SuggestionSplit[];evidence:string[];status:string;created_at:string;reviewed_at:string|null};
export type CategoryRule={rule_id:string;match_type:string;match_value:string;direction:string;category_id:string;category_name:string;is_active:boolean};
