import {SECTIONS,sectionFor} from './commands.mjs';
export const freshDraft=()=>({items:[],stage:null,page:0});
const clean=(s,n)=>typeof s==='string'&&s.trim()&&s.length<=n&&!/[\u0000-\u0008\u000b-\u001f]|\/Users\/|\/home\/|file:\/\//.test(s);
export function summary(draft) {
  const counts={};for(const i of draft.items)counts[i.kind]=(counts[i.kind]||0)+1;
  return Object.entries(counts).map(([kind,n])=>`${n} ${kind==='photo'?'photos':kind==='youtube'?'YouTube links':kind==='message'?'messages':kind==='audio'?'audio clips':'videos'}`).join(', ');
}
export function prompt(draft,events=[]) {
  if(!draft.items.length)return 'Forward the items for one event here first. Photos, videos, YouTube links, text and audio are welcome.';
  if(!draft.stage||draft.stage==='category') {draft.stage='category';return `Received ${summary(draft)}.\nWhich section?\n`+SECTIONS.map(([id,title],i)=>`${i+1}. ${title}`).join('\n');}
  if(draft.stage==='event') {
    const matches=events.filter(e=>e.category===draft.category),page=matches.slice(draft.page*8,draft.page*8+8);
    draft.options=page;
    return 'Which event?\n0. Create a new event\n'+page.map((e,i)=>`${i+1}. ${e.title}`).join('\n')+(matches.length>(draft.page+1)*8?'\nNEXT. More events':'')+'\nOr type the event/school name.';
  }
  if(draft.stage==='title')return 'What is the event, school or institution name? Use its authentic name.';
  if(draft.stage==='caption')return 'What should visitors know about this event? Send a short caption. SAME keeps the forwarded caption; SKIP uses just the event name.';
  return `Ready for the public website:\n${summary(draft)}\n${SECTIONS.find(s=>s[0]===draft.category)?.[1]} · ${draft.title}\n${draft.target?'Add to existing event':'Create new event'}\n\n${draft.caption}\n\n${draft.date?'Occasion date: '+draft.date:'No occasion date supplied.'}\nReply PUBLISH to publish, EDIT to change details, or DATE YYYY-MM-DD to add the actual date. Never include private records.`;
}
export function advance(draft,text,events=[]) {
  text=String(text).trim();
  if(!draft.items.length)return {reply:prompt(draft,events)};
  if(/^edit$/i.test(text)){draft.stage='category';draft.page=0;delete draft.target;return {reply:prompt(draft,events)};}
  if(/^done$/i.test(text))return {reply:prompt(draft,events)};
  if(!draft.stage)draft.stage='category';
  if(draft.stage==='category') {
    const category=SECTIONS[Number(text)-1]?.[0]||sectionFor(text);
    if(!category)return {reply:prompt(draft,events)};
    draft.category=category;draft.stage='event';draft.page=0;return {reply:prompt(draft,events)};
  }
  if(draft.stage==='event') {
    if(/^next$/i.test(text)){const total=events.filter(e=>e.category===draft.category).length;draft.page=(draft.page+1)*8<total?draft.page+1:0;return {reply:prompt(draft,events)};}
    if(text==='0'){draft.stage='title';return {reply:prompt(draft,events)};}
    const chosen=draft.options?.[Number(text)-1]||events.find(e=>e.category===draft.category&&(e.id===text||e.title.toLocaleLowerCase()===text.toLocaleLowerCase()));
    if(chosen){draft.target=chosen.id;draft.title=chosen.title;draft.stage='caption';return {reply:prompt(draft,events)};}
    if(/^\d+$/.test(text)||!clean(text,150))return {reply:prompt(draft,events)};
    draft.target=null;draft.title=text;draft.stage='caption';return {reply:prompt(draft,events)};
  }
  if(draft.stage==='title') {
    if(!clean(text,150))return {reply:'Use an event name up to 150 characters.'};
    const existing=events.find(e=>e.category===draft.category&&e.title.toLocaleLowerCase()===text.toLocaleLowerCase());
    draft.title=existing?.title||text;draft.target=existing?.id||null;draft.stage='caption';return {reply:prompt(draft,events)};
  }
  if(draft.stage==='caption') {
    const caption=/^skip$/i.test(text)?draft.title:/^same$/i.test(text)?draft.items.find(i=>i.caption)?.caption||draft.title:text;
    if(!clean(caption,1500))return {reply:'Send a public caption up to 1500 characters, without private file paths.'};
    draft.caption=caption;draft.stage='review';return {reply:prompt(draft,events)};
  }
  if(/^date\s+/i.test(text)) {
    const date=text.split(/\s+/)[1];
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)return {reply:'Use the actual event date as DATE YYYY-MM-DD.'};
    draft.date=date;return {reply:prompt(draft,events)};
  }
  if(/^publish$/i.test(text))return {publish:{category:draft.category,target:draft.target||null,title:draft.title,caption:draft.caption,date:draft.date||null,location:'',items:draft.items,confirmed:true}};
  return {reply:prompt(draft,events)};
}
