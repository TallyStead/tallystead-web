"use client";

import {useChat} from "@ai-sdk/react";
import {TextStreamChatTransport,UIMessage} from "ai";
import {createContext,ReactNode,useCallback,useContext,useEffect,useMemo,useRef,useState} from "react";
import {Conversation} from "../lib/assistant";
import {apiRequest} from "../lib/client";

type AssistantContextValue={open:boolean;setOpen:(value:boolean)=>void;conversations:Conversation[];conversationId:string|null;selectConversation:(id:string)=>Promise<void>;newConversation:()=>Promise<string>;deleteConversation:(id:string)=>Promise<void>;messages:UIMessage[];send:(text:string)=>Promise<void>;stop:()=>Promise<void>;regenerate:()=>Promise<void>;status:string;error:string;currency:string;setCurrency:(value:string)=>void;scope:string;setScope:(value:string)=>void;dateFrom:string;setDateFrom:(value:string)=>void;dateTo:string;setDateTo:(value:string)=>void;refresh:()=>Promise<void>};
const Context=createContext<AssistantContextValue|null>(null);
const iso=(value:Date)=>value.toISOString().slice(0,10);
const startOfMonth=()=>{const value=new Date();value.setDate(1);return iso(value)};
const uiMessages=(item:Conversation):UIMessage[]=>(item.messages||[]).map(message=>({id:message.message_id,role:message.role,metadata:{citations:message.citations,provider:message.provider,model_version:message.model_version},parts:[{type:"text",text:message.content}]}));

export function AssistantProvider({children,serverUrl,accessToken}:{children:ReactNode;serverUrl:string;accessToken:string}){
 const [open,setOpen]=useState(false),[conversations,setConversations]=useState<Conversation[]>([]),[conversationId,setConversationId]=useState<string|null>(null),[currency,setCurrency]=useState("USD"),[scope,setScope]=useState("household"),[dateFrom,setDateFrom]=useState(startOfMonth()),[dateTo,setDateTo]=useState(iso(new Date())),[error,setError]=useState("");
 const conversationRef=useRef<string|null>(null),filtersRef=useRef({currency,scope,dateFrom,dateTo}),wasStreaming=useRef(false);
 useEffect(()=>{filtersRef.current={currency,scope,dateFrom,dateTo}},[currency,scope,dateFrom,dateTo]);
 const transport=useMemo(()=>new TextStreamChatTransport<UIMessage>({api:`${serverUrl}/v1/assistant/chat`,headers:{Authorization:`Bearer ${accessToken}`},prepareSendMessagesRequest:({messages,trigger})=>({body:{messages,trigger,conversation_id:conversationRef.current,currency_code:filtersRef.current.currency,ownership_scope:filtersRef.current.scope,date_from:filtersRef.current.dateFrom,date_to:filtersRef.current.dateTo}})}),[serverUrl,accessToken]);
 const chat=useChat({id:"tallystead-shared-assistant",transport});
 const request=useCallback(<T,>(path:string,init:RequestInit={})=>apiRequest<T>(serverUrl,path,init,accessToken),[serverUrl,accessToken]);
 const refresh=useCallback(async()=>{setConversations(await request<Conversation[]>("/v1/assistant/conversations"))},[request]);
 const load=useCallback(async(id:string)=>{const item=await request<Conversation>(`/v1/assistant/conversations/${id}`);conversationRef.current=id;setConversationId(id);setCurrency(item.currency_code);setScope(item.ownership_scope);chat.setMessages(uiMessages(item));setError("")},[request,chat]);
 useEffect(()=>{void refresh().catch(reason=>setError(reason instanceof Error?reason.message:"Assistant history could not be loaded."))},[refresh]);
 useEffect(()=>{if(chat.status==="streaming"||chat.status==="submitted")wasStreaming.current=true;else if(wasStreaming.current&&chat.status==="ready"&&conversationRef.current){wasStreaming.current=false;void load(conversationRef.current).then(refresh).catch(()=>{})}},[chat.status,load,refresh]);
 async function newConversation(){const item=await request<Conversation>("/v1/assistant/conversations",{method:"POST",body:JSON.stringify({currency_code:currency,ownership_scope:scope})});conversationRef.current=item.conversation_id;setConversationId(item.conversation_id);chat.setMessages([]);await refresh();return item.conversation_id}
 async function selectConversation(id:string){await load(id)}
 async function deleteConversation(id:string){await request(`/v1/assistant/conversations/${id}`,{method:"DELETE"});if(conversationRef.current===id){conversationRef.current=null;setConversationId(null);chat.setMessages([])}await refresh()}
 async function send(text:string){const value=text.trim();if(!value)return;setError("");if(!conversationRef.current)await newConversation();try{await chat.sendMessage({text:value})}catch(reason){setError(reason instanceof Error?reason.message:"The local assistant could not answer.")}}
 const value:AssistantContextValue={open,setOpen,conversations,conversationId,selectConversation,newConversation,deleteConversation,messages:chat.messages,send,stop:chat.stop,regenerate:()=>chat.regenerate(),status:chat.status,error:error||(chat.error?.message||""),currency,setCurrency,scope,setScope,dateFrom,setDateFrom,dateTo,setDateTo,refresh};
 return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAssistant(){const value=useContext(Context);if(!value)throw new Error("useAssistant must be used inside AssistantProvider");return value}
