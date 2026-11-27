import {SECTIONS,sectionFor} from './commands.mjs';
export const MENU_VERSION='compact-v2';
export const freshDraft=()=>({items:[],stage:null,page:0,menuVersion:MENU_VERSION});
export function resumeDraft(draft) {
  if(draft.menuVersion!==MENU_VERSION&&draft.stage==='caption')nextDetails(draft);
  draft.menuVersion=MENU_VERSION;
  return draft;
}
export function restoreUpload(job,receipt,event) {
  if(receipt?.state!=='published'||!receipt.eventId)throw new Error('That upload has not finished publishing. Send STATUS or RETRY.');
  return {...freshDraft(),items:structuredClone(job.items),stage:'edit',category:event?.category||job.category,target:receipt.eventId,title:event?.title||job.title,caption:job.caption,date:event?(event.date||null):(job.date||null),revisionOf:job.revisionOf||{jobId:job.id,eventId:receipt.eventId}};
}
const backLine='\nB. Back';
function nextDetails(draft){draft.caption ||= draft.items.find(i=>i.caption?.trim())?.caption||draft.title;draft.stage='review';}

const clean=(s,n)=>typeof s==='string'&&s.trim()&&s.length<=n&&!/[\u0000-\u0008\u000b-\u001f]|\/Users\/|\/home\/|file:\/\//.test(s);
export function summary(draft) {
  const counts={};for(const i of draft.items)counts[i.kind]=(counts[i.kind]||0)+1;
  return Object.entries(counts).map(([kind,n])=>`${n} ${{photo:'photo',youtube:'YouTube link',message:'message',audio:'audio clip',video:'video'}[kind]}${n===1?'':'s'}`).join(', ');
}
export function prompt(draft,events=[]) {
  if(!draft.items.length)return 'Forward files or messages for one event.';
  if(draft.stage==='items')return `${summary(draft)} saved.\nDONE to continue · CLEAR to restart`;
  if(draft.stage==='edit')return `Edit:\n1. Section\n2. Event name${draft.revisionOf?'':' / destination'}\n3. Caption (optional)\n4. Occasion date\n5. Review and publish${backLine}`;
  if(draft.stage==='date')return 'Date: YYYY-MM-DD, or NONE.'+backLine;
  if(!draft.stage||draft.stage==='category') {draft.stage='category';return `${summary(draft)} · Choose section:\n`+SECTIONS.map(([id,title],i)=>`${i+1}. ${title}`).join('\n')+backLine;}
  if(draft.stage==='event') {
    const matches=events.filter(e=>e.category===draft.category),page=matches.slice(draft.page*8,draft.page*8+8);
    draft.options=page;
    return 'Choose event:\n0. New event\n'+page.map((e,i)=>`${i+1}. ${e.title}`).join('\n')+(matches.length>(draft.page+1)*8?'\nNEXT. More events':'')+'\nOr type a new event name.'+backLine;
  }
  if(draft.stage==='title')return 'Event or school name?'+backLine;
  if(draft.stage==='caption')return 'Send caption, SAME to keep, or SKIP.'+backLine;
  return `${summary(draft)} · ${SECTIONS.find(s=>s[0]===draft.category)?.[1]}\n${draft.title}\n${draft.revisionOf?'Update event':draft.target?'Add to event':'New event'}${draft.caption&&draft.caption!==draft.title?'\n'+draft.caption:''}${draft.date?'\n'+draft.date:''}\n\nPUBLISH · E. Edit · B. Back`;
}
export function advance(draft,text,events=[]) {
  text=String(text).trim();
  if(!draft.items.length)return {reply:prompt(draft,events)};
  if(/^(?:back|b)$/i.test(text)) {
    const previous={category:'items',event:'category',title:draft.revisionOf?'edit':'event',caption:'edit',review:'edit',edit:draft.caption?'review':'category',date:'edit'};
    draft.stage=previous[draft.stage]||'items';return {reply:prompt(draft,events)};
  }
  if(/^(?:edit|redo|e)$/i.test(text)){draft.stage=draft.caption?'edit':'category';return {reply:prompt(draft,events)};}
  if(draft.stage==='edit') {
    const stage={'1':'category','2':draft.revisionOf?'title':'event','3':'caption','4':'date','5':'review'}[text];
    if(stage)draft.stage=stage;return {reply:prompt(draft,events)};
  }
  if(draft.stage==='date') {
    const value=text.replace(/^date\s+/i,'');
    if(/^none$/i.test(value)){draft.date=null;draft.stage='review';return {reply:prompt(draft,events)};}
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)return {reply:prompt(draft,events)};
    draft.date=value;draft.stage='review';return {reply:prompt(draft,events)};
  }
  if(/^done$/i.test(text)){if(draft.stage==='items')draft.stage='category';return {reply:prompt(draft,events)};}
  if(!draft.stage)draft.stage='category';
  if(draft.stage==='category') {
    const category=SECTIONS[Number(text)-1]?.[0]||sectionFor(text);
    if(!category)return {reply:prompt(draft,events)};
    draft.category=category;draft.stage=draft.revisionOf?'review':'event';draft.page=0;return {reply:prompt(draft,events)};
  }
  if(draft.stage==='event') {
    if(/^next$/i.test(text)){const total=events.filter(e=>e.category===draft.category).length;draft.page=(draft.page+1)*8<total?draft.page+1:0;return {reply:prompt(draft,events)};}
    if(text==='0'){draft.stage='title';return {reply:prompt(draft,events)};}
    const chosen=draft.options?.[Number(text)-1]||events.find(e=>e.category===draft.category&&(e.id===text||e.title.toLocaleLowerCase()===text.toLocaleLowerCase()));
    if(chosen){draft.target=chosen.id;draft.title=chosen.title;nextDetails(draft);return {reply:prompt(draft,events)};}
    if(/^\d+$/.test(text)||!clean(text,150))return {reply:prompt(draft,events)};
    draft.target=null;draft.title=text;nextDetails(draft);return {reply:prompt(draft,events)};
  }
  if(draft.stage==='title') {
    if(!clean(text,150))return {reply:'Use an event name up to 150 characters.'};
    const existing=events.find(e=>e.category===draft.category&&e.title.toLocaleLowerCase()===text.toLocaleLowerCase());
    draft.title=existing?.title||text;if(!draft.revisionOf)draft.target=existing?.id||null;nextDetails(draft);return {reply:prompt(draft,events)};
  }
  if(draft.stage==='caption') {
    const caption=/^skip$/i.test(text)?draft.title:/^same$/i.test(text)?draft.caption||draft.items.find(i=>i.caption)?.caption||draft.title:text;
    if(!clean(caption,1500))return {reply:'Send a public caption up to 1500 characters, without private file paths.'};
    draft.caption=caption;draft.stage='review';return {reply:prompt(draft,events)};
  }
  if(/^date\s+/i.test(text)) {
    const date=text.split(/\s+/)[1];
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)return {reply:'Use the actual event date as DATE YYYY-MM-DD.'};
    draft.date=date;return {reply:prompt(draft,events)};
  }
  if(/^publish$/i.test(text)&&draft.stage==='review')return {publish:{category:draft.category,target:draft.target||null,title:draft.title,caption:draft.caption,date:draft.date||null,location:'',items:draft.items,confirmed:true,...(draft.revisionOf?{revisionOf:draft.revisionOf}:{})}};
  return {reply:prompt(draft,events)};
}
