// Use WhatsApp's native monospace; keep website links outside code formatting.
export function formatReply(value) {
  const fence='`'.repeat(3),parts=['*Website Assistant*'],block=[];
  const flush=()=>{if(block.some(line=>line.trim()))parts.push(fence+'\n'+block.join('\n').replaceAll(fence,'`\u200b`\u200b`')+'\n'+fence);block.length=0;};
  for(const line of String(value).split('\n')) {
    if(/https?:\/\/\S+/i.test(line)){flush();parts.push(line);}
    else block.push(line);
  }
  flush();return parts.join('\n\n');
}
