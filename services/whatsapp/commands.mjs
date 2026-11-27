import {createHash} from 'node:crypto';

const aliases = new Map(Object.entries({
  'his-holiness':'his-holiness', 'his holiness':'his-holiness', swamiji:'his-holiness', shankaracharya:'his-holiness',
  education:'education', school:'education', schools:'education', teachings:'teachings', satsang:'teachings', messages:'teachings',
  devotion:'spiritual-life', celebration:'spiritual-life', events:'spiritual-life', 'spiritual-life':'spiritual-life',
  veda:'vedic-learning', vedic:'vedic-learning', 'vedic learning':'vedic-learning', 'vedic-learning':'vedic-learning',
  annadanam:'annadanam', food:'annadanam', medical:'healthcare', healthcare:'healthcare'
}));
export const HELP = `Forward one event’s files → choose section → event → PUBLISH.
B Back · E Edit · REDO last upload
DONE continue · STATUS progress · RETRY failed upload · CLEAR restart
Caption is optional under Edit. Keep the Mac online; send public content only.`;
export const SECTIONS=[['his-holiness','His Holiness Shankaracharya'],['teachings','Swamiji’s Teachings'],['spiritual-life','Devotion and Celebration'],['vedic-learning','Support for Vedic Learning'],['education','Education'],['annadanam','Annadanam'],['healthcare','Medical']];
export const sectionFor = value => aliases.get(String(value).trim().toLowerCase());

export function parseCommand(text) {
  if (typeof text !== 'string' || text.length > 2200) return null;
  text = text.trim().replace(/^hey\s+sai[,!]?\s*/i, '');
  if (/^(?:back|go back|b)$/i.test(text)) return {kind:'back'};
  if (/^(?:edit(?: last)?|e)$/i.test(text)) return {kind:'edit'};
  if (/^redo(?: upload| last)?$/i.test(text)) return {kind:'redo'};
  if (/^(?:help|status|retry|clear|cancel|edit|done)$/i.test(text)) return {kind:text.toLowerCase()};
  if (!/^upload\b/i.test(text)) return null;
  const fields = text.replace(/^upload\s*/i,'').split('|').map(s=>s.trim());
  if (fields.length < 2 || fields.length > 4) throw new Error('Use UPLOAD section | event name | optional caption.');
  const [section,title,suppliedCaption,date] = fields,caption=suppliedCaption||title;
  const category = aliases.get(section.toLowerCase());
  if (!category) throw new Error('Choose swamiji, teachings, devotion, veda, education, annadanam or medical.');
  if (!title || title.length > 150 || !caption || caption.length > 1500 || /[\u0000-\u0008\u000b-\u001f]|\/Users\/|\/home\/|file:\/\//.test(title+' '+caption)) throw new Error('Use a title up to 150 characters and a public caption up to 1500 characters, without private file paths.');
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date+'T12:00:00Z')) || new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)) throw new Error('Use an actual occasion date in YYYY-MM-DD format, or leave it out.');
  return {kind:'upload',category,title,caption,date:date||null,location:'',confirmed:true};
}

export function messageText(message) {
  return message?.conversation || message?.extendedTextMessage?.text || '';
}

export function isAllowedMessage(message, config) {
  return Boolean(config.chatId && message?.key?.remoteJid === config.chatId && message.key.fromMe === true && !message.key.isViewOnce && Number(message.messageTimestamp || 0) >= Number(config.captureSince || 0));
}

export function messageId(message) {
  const key=message?.key;
  if (!key?.id || !key.remoteJid) throw new Error('This message has no stable identifier.');
  return createHash('sha256').update(key.remoteJid+'\0'+key.id).digest('hex');
}

export function publishableImage(message) {
  const m=message?.message;
  // Do not unwrap disappearing/view-once messages or download documents.
  return m?.imageMessage && !m.imageMessage.viewOnce && /^(?:image\/jpeg|image\/png|image\/webp)$/.test(m.imageMessage.mimetype||'') ? m.imageMessage : null;
}

export function youtubeLinks(text) {
  const links=[],seen=new Set();
  for(const raw of String(text).match(/https?:\/\/[^\s<>]+/gi)||[]) {
    try {
      const u=new URL(raw.replace(/[),.!;\]}*~]+$/,''));
      if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port)continue;
      const host=u.hostname.toLowerCase(),parts=u.pathname.split('/').filter(Boolean);
      const youtube=['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host);
      if(host!=='youtu.be'&&!youtube)continue;
      const id=host==='youtu.be'?parts[0]:u.searchParams.get('v')||(['shorts','embed','live'].includes(parts[0])?parts[1]:null);
      let item;
      if(youtube&&['playlist','embed/videoseries'].includes(parts.join('/'))&&/^[A-Za-z0-9_-]{10,150}$/.test(u.searchParams.get('list')||''))item={youtubePlaylistId:u.searchParams.get('list')};
      else if(/^[A-Za-z0-9_-]{11}$/.test(id||'')&&id!=='videoseries')item={youtubeId:id};
      else if(youtube&&/^\/(?:@[A-Za-z0-9_.%-]{1,200}|(?:channel|c|user)\/[A-Za-z0-9_.%-]{1,200})\/live\/?$/.test(u.pathname))item={youtubeLivePath:u.pathname.replace(/\/$/,'')};
      if(item&&!seen.has(JSON.stringify(item))){seen.add(JSON.stringify(item));links.push(item);}
    } catch {}
  }
  return links;
}
export const youtubeIds=text=>youtubeLinks(text).filter(item=>item.youtubeId).map(item=>item.youtubeId);
// Shared text may precede the URL; explicit upload instructions stay commands.
export const sharedYouTubeItems=text=>/^(?:hey\s+sai[,!]?\s*)?(?:upload|message)\b/i.test(String(text).trim())?[]:youtubeLinks(text).map(item=>({kind:'youtube',...item}));

export function mediaKind(message) {
  const m=message?.message;
  if(!m)return null;
  if(publishableImage(message))return 'photo';
  if(m.videoMessage&&!m.videoMessage.viewOnce)return 'video';
  if(m.audioMessage&&!m.audioMessage.viewOnce)return 'audio';
  const d=m.documentMessage;
  if(d&&(/^audio\//.test(d.mimetype||'')||/\.(mp3|m4a|aac|ogg|opus|flac|wav|amr|aiff|aif|wma|weba|mka)$/i.test(d.fileName||'')))return 'audio';
  if(d&&(/^video\//.test(d.mimetype||'')||/\.(mp4|mov|m4v|webm)$/i.test(d.fileName||'')))return 'video';
  return null;
}
