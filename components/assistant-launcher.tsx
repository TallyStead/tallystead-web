"use client";

import Link from "next/link";
import AssistantChat from "./assistant-chat";
import {useAssistant} from "./assistant-context";

export default function AssistantLauncher(){const {open,setOpen}=useAssistant();return <><button className="assistant-launcher" aria-label="Open Tallystead Assistant" onClick={()=>setOpen(!open)}>✦</button>{open&&<aside className="assistant-popup"><header><span><b>Tallystead Assistant</b><small>Local · read-only</small></span><div><Link href="/assistant" onClick={()=>setOpen(false)}>Open full page</Link><button aria-label="Close assistant" onClick={()=>setOpen(false)}>×</button></div></header><AssistantChat compact/></aside>}</>}
