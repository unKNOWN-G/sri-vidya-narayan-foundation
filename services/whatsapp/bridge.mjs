import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {randomBytes,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import makeWASocket,{useMultiFileAuthState,downloadMediaMessage,DisconnectReason,generateMessageIDV2} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import {HELP,messageText,messageId,isAllowedMessage,mediaKind,sharedYouTubeItems,parseCommand} from './commands.mjs';
import {freshDraft,advance,prompt,summary,restoreUpload,resumeDraft,MENU_VERSION} from './wizard.mjs';
import {formatReply} from './reply-style.mjs';

process.umask(0o077);
const exec=promisify(execFile),SERVICE=path.dirname(fileURLToPath(import.meta.url)),ROOT=path.resolve(SERVICE,'../..');
const PRIVATE=path.join(ROOT,'private/whatsapp'),ORIGINALS=path.join(ROOT,'media/whatsapp/originals'),PYTHON=path.join(SERVICE,'.venv/bin/python');
const PORT=8998,ORIGIN=`http://127.0.0.1:${PORT}`,WEB_KEY=randomBytes(24).toString('hex');
await fs.mkdir(PRIVATE,{recursive:true,mode:0o700});await fs.chmod(PRIVATE,0o700);await fs.mkdir(ORIGINALS,{recursive:true,mode:0o700});
async function readJSON(file,fallback){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
async function writeJSON(file,value){await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});await fs.writeFile(file+'.tmp',JSON.stringify(value,null,2),{mode:0o600});await fs.rename(file+'.tmp',file);}
const STATE_FILE=path.join(PRIVATE,'state.json');
const state=await readJSON(STATE_FILE,{config:{chatId:null,captureSince:0},draft:freshDraft(),seen:[],jobs:[]});
resumeDraft(state.draft);
let socket=null,connection='Not linked',qr=null,allowConnect=process.argv.includes('--connect'),stopping=false,intake=Promise.resolve(),publishing=Promise.resolve(),idleTimer,queueDepth=0,events=[],catalogAt=0,saveChain=Promise.resolve(),outboxChain=Promise.resolve(),resumedPrompt=false;
const bindCode=randomBytes(4).toString('hex').toUpperCase(),seen=new Set(state.seen),logger=pino({level:'silent'});
const save=()=>{state.seen=[...seen];const snapshot=structuredClone(state);saveChain=saveChain.then(()=>writeJSON(STATE_FILE,snapshot));return saveChain;};
async function drainOutbox(){
  while(socket&&state.config.chatId&&connection==='Connected'&&state.outbox?.length){
    const item=state.outbox[0];
    try{await socket.sendMessage(state.config.chatId,{text:formatReply(item.text)},{messageId:item.id});state.outbox.shift();await save();}catch{return;}
  }
}
function flush(){outboxChain=outboxChain.then(drainOutbox).catch(()=>{});return outboxChain;}
async function reply(text){
  if(!state.config.chatId)return;
  const id=generateMessageIDV2(socket?.user?.id);state.outgoing??=[];state.outbox??=[];state.outgoing.push(id);state.outbox.push({id,text});await save();await flush();
}
async function loadCatalog(){if(Date.now()-catalogAt>60000){const {stdout}=await exec(PYTHON,[path.join(ROOT,'scripts/whatsapp_publish.py'),'--catalog'],{cwd:ROOT,maxBuffer:1024*1024});events=JSON.parse(stdout);catalogAt=Date.now();}return events;}
async function runJob(id){
  const entry=state.jobs.find(j=>j.id===id);if(!entry||entry.state==='published')return;
  entry.state='publishing';entry.error=null;await save();
  try{
    const {stdout}=await exec(PYTHON,[path.join(ROOT,'scripts/whatsapp_publish.py'),'--job',path.join(PRIVATE,'jobs',id,'job.json')],{cwd:ROOT,maxBuffer:1024*1024});
    const result=JSON.parse(stdout);if(result.error)throw new Error(result.error);
    entry.state='published';entry.url=result.url;entry.runUrl=result.runUrl;entry.error=null;catalogAt=0;await save();
    await reply(`Published: ${entry.title}\n${result.url}\nREDO to edit.`);
  }catch(e){
    let detail='Upload saved. Check Mac/GitHub connection, then RETRY.';
    try{const info=JSON.parse(e.stdout||'{}');if(info.error&&!/(?:\/Users\/|\/home\/|Bearer|token|secret)/i.test(info.error))detail=info.error;}catch{}
    entry.state='failed';entry.error=detail;await save();await reply('Publishing needs attention. '+detail);
  }
}
function enqueue(id){publishing=publishing.then(()=>runJob(id)).catch(()=>{console.error('A private publishing task needs attention.');});}
async function queueJob(job){
  job.id=randomUUID();await writeJSON(path.join(PRIVATE,'jobs',job.id,'job.json'),job);
  state.jobs.push({id:job.id,state:'queued',title:job.title,created:Date.now()});state.draft=freshDraft();await save();
  await reply(`Publishing: ${job.title}.`);enqueue(job.id);
}
function laterPrompt(){
  clearTimeout(idleTimer);idleTimer=setTimeout(async()=>{
    if(queueDepth){laterPrompt();return;}
    intake=intake.then(async()=>{if(state.draft.items.length){await reply(prompt(state.draft,await loadCatalog()));await save();}}).catch(()=>reply('The items are saved. Send DONE to continue.'));
  },5000);
}
async function receive(message){
  const text=messageText(message.message).trim();
  if(!state.config.chatId){
    if(message.key?.fromMe===true&&message.key.remoteJid?.endsWith('@g.us')&&text===`WEBSITE LINK ${bindCode}`){
      state.config={chatId:message.key.remoteJid,captureSince:Math.floor(Date.now()/1000),ownerOnly:true};seen.add(messageId(message));await save();
      await reply('Upload group connected.\n\n'+HELP);
    }
    return;
  }
  if(!isAllowedMessage(message,state.config))return;
  const id=messageId(message);if(seen.has(id))return;
  const m=message.message||{},kind=mediaKind(message),forwarded=Boolean(m.extendedTextMessage?.contextInfo?.isForwarded||m.extendedTextMessage?.contextInfo?.forwardingScore);
  const links=sharedYouTubeItems(text);
  if(state.draft.revisionOf&&(kind||links.length||forwarded||/^message\s+/i.test(text))){await reply('PUBLISH this edit, or CLEAR to start another event.');return;}
  if(kind){
    if(state.draft.items.length>=200){await reply('This event already has 200 items. Finish it before forwarding another set.');return;}
    const max=kind==='photo'?20*1024*1024:250*1024*1024;
    if(!state.draft.items.length&&!state.draft.receiving){state.draft.receiving=true;await save();await reply('Receiving files… Send DONE when ready.');}
    const stream=await downloadMediaMessage(message,'stream',{}, {logger,reuploadRequest:socket.updateMediaMessage});
    const destination=path.join(ORIGINALS,id+'.bin'),temp=destination+'.tmp';const file=await fs.open(temp,'w',0o600);let size=0;
    let complete=false;
    try{for await(const piece of stream){size+=piece.length;if(size>max)throw new Error('This file is too large. Use a YouTube link for long recordings.');await file.write(piece);}complete=true;}finally{await file.close();if(!complete){stream.destroy();await fs.unlink(temp).catch(()=>{});}}
    await fs.rename(temp,destination);
    state.draft.items.push({kind,file:id+'.bin',caption:(m.imageMessage?.caption||m.videoMessage?.caption||'').slice(0,1500)});seen.add(id);await save();laterPrompt();return;
  }
  if(links.length){
    if(state.draft.items.length+links.length>200)throw new Error('Finish this event before sending more links.');
    state.draft.items.push(...links);seen.add(id);await save();laterPrompt();return;
  }
  if(m.documentMessage||m.viewOnceMessage||m.viewOnceMessageV2||m.ephemeralMessage){seen.add(id);await save();await reply('Send photos, video, audio, text or YouTube links. No documents or view-once items.');return;}
  if(!text)return;
  const command=/\|/.test(text)||/^(?:hey\s+sai[,!]?\s*)?(?:help|status|retry|clear|cancel|edit(?: last)?|redo(?: upload| last)?|done|back|go back|b|e)$/i.test(text)?parseCommand(text):null;
  if(forwarded||/^message\s+/i.test(text)||(!state.draft.stage&&!command&&!/^publish$/i.test(text))){
    const body=text.replace(/^message\s+/i,'');if(body.length>20000)throw new Error('Split this message into shorter messages.');
    if(state.draft.items.length>=200)throw new Error('Finish this event before sending more messages.');
    state.draft.items.push({kind:'message',text:body});seen.add(id);await save();laterPrompt();return;
  }
  seen.add(id);clearTimeout(idleTimer);
  if(['edit','redo'].includes(command?.kind)&&!state.draft.items.length){
    const previous=[...state.jobs].reverse().find(j=>j.state==='published');
    if(!previous){await save();await reply('No published upload yet. Forward files, or RETRY a failed upload.');return;}
    const folder=path.join(PRIVATE,'jobs',previous.id),job=await readJSON(path.join(folder,'job.json'),null),receipt=await readJSON(path.join(folder,'result.json'),null),catalog=await loadCatalog();
    state.draft=restoreUpload(job,receipt,catalog.find(e=>e.id===receipt?.eventId));await save();await reply(prompt(state.draft,catalog));return;
  }
  if(command?.kind==='help'){await save();await reply(HELP);return;}
  if(command?.kind==='status'){
    await save();const recent=state.jobs.slice(-5);await reply((state.draft.items.length?`Pending: ${summary(state.draft)}.\n`:'')+(recent.map(j=>`${j.title}: ${j.state}${j.url?'\n'+j.url:''}${j.error?'\n'+j.error:''}`).join('\n\n')||'No uploads yet.'));return;
  }
  if(command?.kind==='retry'){
    const job=[...state.jobs].reverse().find(j=>j.state==='failed');if(!job){await save();await reply('No failed uploads. Send STATUS.');return;}
    job.state='queued';await save();await reply('Retrying saved upload.');enqueue(job.id);return;
  }
  if(['clear','cancel'].includes(command?.kind)){state.draft=freshDraft();await save();await reply('Cleared. Forward the next event.');return;}
  const catalog=await loadCatalog();
  if(command?.kind==='upload'){
    if(!state.draft.items.length){await reply('Forward files before UPLOAD.');return;}
    const exact=catalog.filter(e=>e.category===command.category&&(e.title.toLowerCase()===command.title.toLowerCase()||e.id===command.title));
    if(exact.length>1)throw new Error('More than one event has that name. Send EDIT and select the event from its section.');
    await queueJob({...command,target:exact[0]?.id||null,items:state.draft.items});return;
  }
  const answer=['back','edit','redo','done'].includes(command?.kind)?command.kind:text;
  const action=advance(state.draft,answer,catalog);if(action.publish)await queueJob(action.publish);else{await save();await reply(action.reply);}
}
async function connect(){
  if(stopping||socket&&['Connecting','Connected','Scan the QR code'].includes(connection))return;
  const authDir=path.join(PRIVATE,'auth');await fs.mkdir(authDir,{recursive:true,mode:0o700});
  const {state:auth,saveCreds}=await useMultiFileAuthState(authDir);
  connection='Connecting';
  socket=makeWASocket({auth,logger,markOnlineOnConnect:false,syncFullHistory:false,shouldSyncHistoryMessage:()=>false,emitOwnEvents:false,browser:['Foundation Website Companion','Chrome','1.0.0']});
  socket.ev.on('creds.update',saveCreds);
  socket.ev.on('connection.update',async update=>{
    if(update.qr){qr=await QRCode.toDataURL(update.qr);connection='Scan the QR code';}
    if(update.connection==='open'){
      connection='Connected';qr=null;console.log('WhatsApp companion connected. No chat content is logged.');void flush();
      if(!resumedPrompt){resumedPrompt=true;intake=intake.then(async()=>{
        const styleChanged=state.replyStyleVersion!=='assistant-monospace-v1';
        if(styleChanged){state.replyStyleVersion='assistant-monospace-v1';await save();}
        if(state.draft.items.length){await reply(prompt(state.draft,await loadCatalog()));await save();}
        else if(styleChanged)await reply('Assistant replies now use this distinct text style, so they are easier to recognise. Your typed messages stay unchanged.');
      }).catch(()=>{});}
    }
    if(update.connection==='close'){
      const code=update.lastDisconnect?.error?.output?.statusCode;socket=null;qr=null;
      connection=code===DisconnectReason.loggedOut?'Link expired — relink on this Mac':code===403?'WhatsApp access was refused — review the account/network settings':'Reconnecting';
      if(![DisconnectReason.loggedOut,403].includes(code)&&!stopping&&allowConnect)setTimeout(()=>connect().catch(()=>{connection='Connection needs attention';}),15000);
    }
  });
  socket.ev.on('messages.upsert',({messages})=>{
    for(const message of messages){
      if(message.key?.fromMe!==true||state.outgoing?.includes(message.key?.id))continue;
      if(state.config.chatId&&message.key.remoteJid!==state.config.chatId)continue;
      if(!state.config.chatId&&!message.key.remoteJid?.endsWith('@g.us'))continue;
      queueDepth++;intake=intake.then(()=>receive(message)).catch(async e=>{if(state.config.chatId===message.key?.remoteJid&&message.key?.fromMe===true)await reply('This item needs attention. '+(/large|shorter|200|name|caption|section|Choose|Use /.test(e.message)&&!e.message.includes('/Users/')?e.message:'The pending items are saved. Send DONE to continue.'));}).finally(()=>{queueDepth--;});
    }
  });
}

const setupHTML=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Foundation · WhatsApp gateway</title><style>body{margin:0;background:#faf5eb;color:#342a20;font:17px/1.6 system-ui}main{max-width:780px;margin:5vh auto;padding:28px}h1{font:clamp(35px,5vw,55px)/1.1 Georgia;margin:20px 0}small{letter-spacing:3px;color:#82613a}section{background:#fffdf8;border-radius:24px;padding:28px;margin:24px 0}button{background:#684a2e;color:white;border:0;border-radius:20px;padding:14px 24px;font:inherit}#qr{max-width:280px;width:100%;display:none}code{background:#f1e7d5;padding:8px;border-radius:8px;display:inline-block}p{max-width:64ch}.muted{color:#776956}</style><main><small>SRI VIDYA NARAYAN FOUNDATION</small><h1>From your WhatsApp.<br>To Swamiji’s website.</h1><p>Forward a set of photos, videos, audio, YouTube links or messages. Choose the section and event. Reply <b>PUBLISH</b> to publish.</p><section><strong id="connection">Checking setup…</strong><p id="notice">Account linking has not started. No WhatsApp messages are being read.</p><img id="qr" alt="WhatsApp linked-device QR code"><p id="bind" hidden>After linking, send this from your own number in the dedicated upload group:<br><code>WEBSITE LINK ${bindCode}</code></p><p id="linked" hidden>Your dedicated upload group is connected. Other chats and other people’s messages are ignored.</p></section><p class="muted">Free local companion. The Mac must stay awake and online. This uses the unofficial Baileys library, not Meta’s business API; WhatsApp can restrict or break this integration. Authentication and original files stay private on this Mac. Only an explicit upload/publish command releases selected content to the public website.</p></main><script>async function refresh(){try{const r=await fetch('/api/state',{headers:{'X-Setup-Key':'${WEB_KEY}'}}),s=await r.json();document.querySelector('#connection').textContent=s.connection;document.querySelector('#notice').textContent=s.started?'On your phone: WhatsApp → Settings → Linked devices → Link a device. Scan this code on the Mac.':'Awaiting your one-time linking approval. No account is connected.';const q=document.querySelector('#qr');q.style.display=s.qr?'block':'none';if(s.qr)q.src=s.qr;document.querySelector('#bind').hidden=!s.started||s.linked;document.querySelector('#linked').hidden=!s.linked;if(s.linked)document.querySelector('#notice').textContent='Forward one event at a time in the upload group. The guided questions appear there.';}catch{}setTimeout(refresh,2000)}refresh()</script></html>`;
const server=createServer((request,response)=>{
  if(request.headers.host!==`127.0.0.1:${PORT}`){response.writeHead(403);response.end();return;}
  response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Referrer-Policy','no-referrer');
  if(request.url==='/health'&&request.method==='GET'){response.setHeader('Content-Type','application/json');response.end(JSON.stringify({connection,qrReady:Boolean(qr),groupLinked:Boolean(state.config.chatId),pendingItems:state.draft.items.length,menuVersion:MENU_VERSION,replyStyle:'assistant-monospace-v1',youtubeLinks:'live-playlist-v1'}));return;}
  if(request.url==='/'&&request.method==='GET'){response.setHeader('Content-Type','text/html; charset=utf-8');response.end(setupHTML);return;}
  if(request.url==='/api/state'&&request.method==='GET'&&request.headers['x-setup-key']===WEB_KEY){response.setHeader('Content-Type','application/json');response.end(JSON.stringify({connection,qr,started:allowConnect,linked:Boolean(state.config.chatId)}));return;}
  response.writeHead(404);response.end();
});
server.listen(PORT,'127.0.0.1',()=>console.log(`Private setup: ${ORIGIN}. WhatsApp linking ${allowConnect?'requested':'not started'}.`));
server.on('error',()=>{console.error('The private setup port is already in use. Stop the other companion before starting again.');process.exit(1);});
if(allowConnect)await connect();
for(const j of state.jobs)if(['queued','publishing'].includes(j.state))enqueue(j.id);
process.on('SIGTERM',()=>{stopping=true;clearTimeout(idleTimer);socket?.end(new Error('Stopped by owner'));server.close(()=>process.exit(0));});
