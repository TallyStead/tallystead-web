"use client";

import Link from "next/link";
import {FormEvent,useEffect,useRef,useState} from "react";
import {Citation} from "../lib/assistant";
import {useAssistant} from "./assistant-context";
import AssistantMarkdown from "./assistant-markdown";
import {EmptyState,Notice,Pill} from "./ui";

const starters=["How much did we spend this month?","What categories are highest?","What bills are coming up?","Show unusual spending."];
function textOf(parts:Array<Record<string,unknown>>){return parts.filter(part=>part.type==="text").map(part=>String(part.text||"")).join("")}
export default function AssistantChat({compact=false}:{compact?:boolean}){
 const assistant=useAssistant(),[input,setInput]=useState(""),bottom=useRef<HTMLDivElement>(null),busy=assistant.status==="streaming"||assistant.status==="submitted";
 useEffect(()=>{bottom.current?.scrollIntoView({behavior:"smooth"})},[assistant.messages]);
 async function submit(event:FormEvent){event.preventDefault();const value=input;setInput("");await assistant.send(value)}
 return <div className={`assistant-chat${compact?" compact":""}`}>
  {!compact&&<div className="assistant-controls"><label>From<input type="date" value={assistant.dateFrom} onChange={event=>assistant.setDateFrom(event.target.value)}/></label><label>To<input type="date" value={assistant.dateTo} onChange={event=>assistant.setDateTo(event.target.value)}/></label><label>Currency<select value={assistant.currency} onChange={event=>assistant.setCurrency(event.target.value)}><option>USD</option><option>CAD</option><option>MXN</option></select></label><label>Scope<select value={assistant.scope} onChange={event=>assistant.setScope(event.target.value)}><option value="household">Household</option><option value="business">Business</option><option value="all">All scopes</option></select></label></div>}
  <div className="assistant-messages" aria-live="polite">{!assistant.messages.length?<div className="assistant-welcome"><div className="assistant-orb">✦</div><EmptyState title="Ask about your household">The assistant reads authorized Tallystead reports and cites its sources. It cannot change financial records.</EmptyState><div className="assistant-starters">{starters.map(item=><button type="button" key={item} onClick={()=>void assistant.send(item)}>{item}</button>)}</div></div>:assistant.messages.map(message=>{const metadata=(message.metadata||{}) as {citations?:Citation[];provider?:string},content=textOf(message.parts as Array<Record<string,unknown>>)||"…";return <article className={`assistant-message ${message.role}`} key={message.id}><div className="assistant-role">{message.role==="user"?"You":"Tallystead"}</div><div className="assistant-bubble">{message.role==="assistant"?<AssistantMarkdown>{content}</AssistantMarkdown>:content}</div>{metadata.citations?.length?<details className="assistant-sources"><summary>{metadata.citations.length} sources</summary>{metadata.citations.map(source=><Link href={source.href} key={source.id}><b>{source.id}</b> {source.label}</Link>)}</details>:null}</article>})}<div ref={bottom}/></div>
  {assistant.error&&<Notice title="Local assistant">{assistant.error}</Notice>}
  <form className="assistant-composer" onSubmit={submit}><textarea value={input} onChange={event=>setInput(event.target.value)} placeholder="Ask about spending, bills, cash flow, or your reports…" maxLength={4000} rows={compact?2:3}/><div><span><Pill tone="blue">Read-only</Pill> <small>Local AI</small></span>{busy?<button type="button" className="button compact" onClick={()=>void assistant.stop()}>Stop</button>:<button className="button primary" disabled={!input.trim()}>Send</button>}</div></form>
 </div>
}
