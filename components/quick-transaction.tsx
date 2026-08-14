"use client";

import { FormEvent, useState } from "react";
import { useAppSession } from "./app-shell";
import { apiRequest } from "../lib/client";
import { DocumentDetail } from "../lib/documents";
import { Account, Category, minorUnits, today, Transaction } from "../lib/ledger";

async function encode(file:File){return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]||"");reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file)})}

export default function QuickTransaction({accounts,categories,onCancel,onComplete}:{accounts:Account[];categories:Category[];onCancel:()=>void;onComplete:(message:string)=>void|Promise<void>}){
  const {serverUrl,session}=useAppSession();
  const [direction,setDirection]=useState<"outflow"|"inflow">("outflow"),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const form=event.currentTarget,data=new FormData(form),account=accounts.find(item=>item.account_id===data.get("account")),total=minorUnits(String(data.get("amount")||"")),file=data.get("receipt") as File;
    if(!account||!total||total<=0)return;
    if(file?.size>15_000_000){setError("Receipt attachments must be 15 MB or smaller.");return}
    const sign=direction==="outflow"?-1:1,categoryId=String(data.get("category")||"");
    setBusy(true);setError("");
    try{
      const transaction=await apiRequest<Transaction>(serverUrl,"/v1/ledger/transactions",{method:"POST",body:JSON.stringify({account_id:account.account_id,transaction_date:data.get("date"),amount_minor:sign*total,currency_code:account.currency_code,status:"posted",payee:data.get("payee")||null,memo:data.get("memo")||null,splits:categoryId?[{category_id:categoryId,amount_minor:sign*total}]:[]})},session.access_token);
      if(file?.size){
        try{
          const document=await apiRequest<DocumentDetail>(serverUrl,"/v1/documents",{method:"POST",body:JSON.stringify({kind:"receipt",filename:file.name,content_type:file.type||"application/octet-stream",data_base64:await encode(file),account_id:account.account_id,document_date:data.get("date"),amount_minor:total,currency_code:account.currency_code,payee:data.get("payee")||null,notes:"Attached during quick transaction entry."})},session.access_token);
          await apiRequest(serverUrl,`/v1/documents/${document.document.document_id}/matches`,{method:"POST",body:JSON.stringify({transaction_id:transaction.transaction_id})},session.access_token);
          await onComplete("Transaction saved and the receipt was stored locally and linked.");
        }catch(attachmentError){
          await onComplete(`Transaction saved, but the receipt could not be attached: ${attachmentError instanceof Error?attachmentError.message:"attachment failed"}`);
        }
      }else await onComplete("Transaction saved.");
    }catch(value){setError(value instanceof Error?value.message:"The transaction could not be saved.")}finally{setBusy(false)}
  }
  const activeAccounts=accounts.filter(item=>!item.is_archived),eligibleCategories=categories.filter(item=>!item.is_archived&&item.category_type===(direction==="outflow"?"expense":"income"));
  return <section className="quick-transaction-panel" aria-label="Quick transaction entry"><div className="title-with-status"><div><p className="eyebrow">Quick entry</p><h2>Add a transaction</h2><p className="muted">Record it now and optionally attach a receipt photo from this device.</p></div><button type="button" className="button compact" onClick={onCancel}>Cancel</button></div>{error&&<p className="status-message">{error}</p>}{!activeAccounts.length?<p className="empty-inline">Create an account before recording a transaction.</p>:<form className="quick-transaction-form" onSubmit={save}><label>Money movement<select value={direction} onChange={event=>setDirection(event.target.value as "outflow"|"inflow")}><option value="outflow">Money out</option><option value="inflow">Money in</option></select></label><label>Account<select name="account" required>{activeAccounts.map(item=><option key={item.account_id} value={item.account_id}>{item.name} · {item.currency_code}</option>)}</select></label><label>Date<input name="date" type="date" defaultValue={today()} required/></label><label>Amount<input name="amount" inputMode="decimal" placeholder="0.00" required/></label><label>Payee or payer<input name="payee" placeholder={direction==="outflow"?"Store or person":"Employer or payer"}/></label><label>Category<select name="category" required><option value="">Choose category</option>{eligibleCategories.map(item=><option key={item.category_id} value={item.category_id}>{item.name}</option>)}</select></label><label className="quick-receipt">Receipt photo or file<input name="receipt" type="file" accept="image/png,image/jpeg,image/webp,application/pdf,.png,.jpg,.jpeg,.webp,.pdf" capture="environment"/><small>Optional · take a photo on mobile or choose an existing image/PDF · stored on your local server</small></label><label className="quick-memo">Note<input name="memo" placeholder="Optional note"/></label><div className="quick-transaction-actions"><button className="button primary" disabled={busy}>{busy?"Saving…":"Save transaction"}</button><small>The receipt is linked only after the transaction is saved successfully.</small></div></form>}</section>
}
