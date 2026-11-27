import test from 'node:test';
import assert from 'node:assert/strict';
import {freshDraft,advance,prompt} from '../wizard.mjs';
import {mediaKind,youtubeIds,isAllowedMessage,parseCommand} from '../commands.mjs';

const events=[{id:'school',category:'education',title:'Air Force School, Yelahanka'},{id:'food',category:'annadanam',title:'Tirumala Annadanam'}];
test('one mixed event is only released after its explicit review confirmation',()=>{
  const draft=freshDraft();draft.items=['photo','video','audio','youtube','message'].map(kind=>({kind}));
  assert.match(prompt(draft,events),/5\. Education/);
  assert.equal(advance(draft,'5',events).publish,undefined);
  assert.equal(draft.options.length,1);assert.equal(draft.options[0].id,'school');
  advance(draft,'1',events);advance(draft,'Swamiji blessed the students.',events);
  assert.equal(draft.stage,'review');assert.equal(advance(draft,'yes',events).publish,undefined);
  const job=advance(draft,'PUBLISH',events).publish;
  assert.equal(job.target,'school');assert.equal(job.category,'education');assert.equal(job.items.length,5);assert.equal(job.confirmed,true);assert.equal(job.date,null);
});
test('new events keep authentic supplied titles and dates are never inferred',()=>{
  const d=freshDraft();d.items=[{kind:'photo'}];prompt(d,events);advance(d,'education',events);advance(d,'0',events);advance(d,'Gollapalli High School',events);advance(d,'SKIP',events);
  assert.equal(d.title,'Gollapalli High School');assert.equal(d.caption,d.title);assert.equal(d.date,undefined);
  advance(d,'DATE 2026-02-30',events);assert.equal(d.date,undefined);
  advance(d,'DATE 2004-11-27',events);assert.equal(advance(d,'publish',events).publish.date,'2004-11-27');
});
test('the other chats and group members never pass the intake gate',()=>{
  const config={chatId:'allowed@g.us',captureSince:100};const message={key:{remoteJid:'allowed@g.us',fromMe:true},messageTimestamp:101};
  assert.equal(isAllowedMessage(message,config),true);
  assert.equal(isAllowedMessage({...message,key:{...message.key,remoteJid:'private@s.whatsapp.net'}},config),false);
  assert.equal(isAllowedMessage({...message,key:{...message.key,fromMe:false}},config),false);
  assert.equal(isAllowedMessage({...message,messageTimestamp:99},config),false);
});
test('media supports voice notes and audio documents, but never view-once photos or PDFs',()=>{
  assert.equal(mediaKind({message:{audioMessage:{ptt:true,mimetype:'audio/ogg; codecs=opus'}}}),'audio');
  assert.equal(mediaKind({message:{documentMessage:{fileName:'talk.FLAC',mimetype:'application/octet-stream'}}}),'audio');
  assert.equal(mediaKind({message:{videoMessage:{mimetype:'video/mp4'}}}),'video');
  assert.equal(mediaKind({message:{viewOnceMessage:{message:{imageMessage:{mimetype:'image/jpeg'}}}}}),null);
  assert.equal(mediaKind({message:{documentMessage:{fileName:'receipt.pdf',mimetype:'application/pdf'}}}),null);
});
test('YouTube intake accepts real video IDs and excludes lookalike domains and playlists',()=>{
  assert.deepEqual(youtubeIds('https://youtu.be/AbCdEfG1234 https://youtube.com/shorts/AbCdEfG1234'),['AbCdEfG1234']);
  assert.deepEqual(youtubeIds('https://youtube.com.evil.test/watch?v=AbCdEfG1234 https://youtube.com/playlist?list=anything'),[]);
});
test('compact commands remain optional and private paths are rejected',()=>{
  assert.equal(parseCommand('Hey Sai, UPLOAD education | Gollapalli High School | Students met Swamiji.').category,'education');
  assert.throws(()=>parseCommand('UPLOAD education | School | /Users/private/person'));
  assert.equal(parseCommand('normal forwarded text'),null);
});
