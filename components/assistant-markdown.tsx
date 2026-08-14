"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function AssistantMarkdown({children}:{children:string}) {
  return <div className="assistant-markdown"><ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      a:({href,children:label})=><a href={href} target={href?.startsWith("http")?"_blank":undefined} rel={href?.startsWith("http")?"noreferrer":undefined}>{label}</a>,
      table:({children:tableChildren})=><div className="assistant-table-wrap"><table>{tableChildren}</table></div>,
      input:({checked,...props})=><input {...props} checked={checked} disabled />,
    }}
  >{children}</ReactMarkdown></div>;
}
