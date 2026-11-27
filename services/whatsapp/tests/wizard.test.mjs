import test from 'node:test';
import assert from 'node:assert/strict';
import {freshDraft,advance,prompt,restoreUpload,resumeDraft,MENU_VERSION} from '../wizard.mjs';
import {mediaKind,youtubeIds,youtubeLinks,sharedYouTubeItems,isAllowedMessage,parseCommand} from '../commands.mjs';

const events=[{id:'school',category:'education',title:'Air Force School, Yelahanka'},{id:'food',category:'annadanam',title:'Tirumala Annadanam'}];
test('one mixed event is only released after its explicit review confirmation',()=>{
  const draft=freshDraft();draft.items=['photo','video','audio','youtube','message'].map(kind=>({kind}));
  assert.match(prompt(draft,events),/5\. Education/);
  assert.equal(advance(draft,'5',events).publish,undefined);
  assert.equal(draft.options.length,1);assert.equal(draft.options[0].id,'school');
  advance(draft,'1',events);assert.equal(draft.caption,'Air Force School, Yelahanka');
  assert.equal(draft.stage,'review');assert.equal(advance(draft,'yes',events).publish,undefined);
  const job=advance(draft,'PUBLISH',events).publish;
  assert.equal(job.target,'school');assert.equal(job.category,'education');assert.equal(job.items.length,5);assert.equal(job.confirmed,true);assert.equal(job.date,null);
});
test('new events keep authentic supplied titles and dates are never inferred',()=>{
  const d=freshDraft();d.items=[{kind:'photo'}];prompt(d,events);advance(d,'education',events);advance(d,'0',events);advance(d,'Gollapalli High School',events);assert.equal(d.stage,'review');
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

test('Back is visible at every question and keeps the complete pending set',()=>{
  const d=freshDraft();d.items=Array.from({length:25},(_,i)=>({kind:'photo',file:String(i)}));const original=structuredClone(d.items);
  assert.match(prompt(d,events),/B\. Back/);advance(d,'5',events);assert.match(prompt(d,events),/B\. Back/);
  advance(d,'0',events);assert.equal(d.stage,'title');advance(d,'B',events);assert.equal(d.stage,'event');
  advance(d,'BACK',events);assert.equal(d.stage,'category');advance(d,'BACK',events);assert.equal(d.stage,'items');
  assert.equal(advance(d,'PUBLISH',events).publish,undefined);advance(d,'DONE',events);assert.equal(d.stage,'category');assert.deepEqual(d.items,original);
});
test('review edits change only selected details without re-forwarding files',()=>{
  const d={...freshDraft(),items:[{kind:'audio',file:'saved'}],stage:'review',category:'education',target:'school',title:'Air Force School, Yelahanka',caption:'Original caption.',date:null};
  assert.match(advance(d,'EDIT',events).reply,/3\. Caption/);advance(d,'3',events);advance(d,'Corrected caption.',events);
  assert.equal(d.stage,'review');assert.equal(d.category,'education');assert.equal(d.target,'school');assert.equal(d.items[0].file,'saved');
  advance(d,'BACK',events);assert.equal(d.stage,'edit');advance(d,'3',events);advance(d,'Updated caption.',events);
  assert.equal(advance(d,'PUBLISH',events).publish.caption,'Updated caption.');
});
test('redo preserves original media ownership and updates the same published page',()=>{
  const job={id:'11111111-1111-4111-8111-111111111111',items:[{kind:'photo',file:'saved'}],category:'education',title:'School',caption:'Old caption.',date:null};
  const d=restoreUpload(job,{state:'published',eventId:'existing-page'},{id:'existing-page',category:'education',title:'School',date:null});
  advance(d,'1',events);advance(d,'7',events);assert.equal(d.stage,'review');assert.equal(d.category,'healthcare');
  advance(d,'EDIT',events);advance(d,'3',events);advance(d,'Correct caption.',events);
  const replacement=advance(d,'PUBLISH',events).publish;
  assert.equal(replacement.target,'existing-page');assert.equal(replacement.revisionOf.jobId,job.id);assert.equal(replacement.items.length,1);assert.equal(job.caption,'Old caption.');
  assert.equal(parseCommand('B').kind,'back');assert.equal(parseCommand('REDO upload').kind,'redo');
});

// No caption question is required for either a new or existing event.
test('forwarded captions survive the shorter flow; public release still requires PUBLISH',()=>{
  const d={...freshDraft(),items:[{kind:'photo',caption:'Blessings for the students.'}]};
  prompt(d,events);advance(d,'5',events);advance(d,'1',events);
  assert.equal(d.stage,'review');assert.equal(d.caption,'Blessings for the students.');
  assert.equal(advance(d,'yes',events).publish,undefined);
  assert.equal(advance(d,'PUBLISH',events).publish.caption,'Blessings for the students.');
  assert.ok(prompt(d,events).length<250);assert.doesNotMatch(prompt(d,events),/No occasion date|Never include/);
});
test('saved old caption questions resume at review without losing files or supplied text',()=>{
  const d={items:[{kind:'photo',file:'saved'}],stage:'caption',title:'School',category:'education'};
  resumeDraft(d);assert.equal(d.stage,'review');assert.equal(d.caption,'School');assert.equal(d.items[0].file,'saved');
  assert.equal(d.menuVersion,MENU_VERSION);
  const editing={...freshDraft(),items:[{kind:'photo'}],stage:'caption',caption:'Keep this.'};
  resumeDraft(editing);assert.equal(editing.stage,'caption');assert.equal(editing.caption,'Keep this.');
});
test('compact upload accepts a title without a caption',()=>{
  const command=parseCommand('UPLOAD education | Gollapalli High School');
  assert.equal(command.caption,'Gollapalli High School');assert.equal(command.confirmed,true);
});

test('live shares, mobile links and a title before the link are recognised as YouTube items',()=>{
  for(const url of ['https://www.youtube.com/live/HI56GgLP_cE?si=share','https://m.youtube.com/watch?v=HI56GgLP_cE','https://youtu.be/HI56GgLP_cE?feature=shared']) {
    assert.deepEqual(sharedYouTubeItems('Watch Swamiji here: '+url),[{kind:'youtube',youtubeId:'HI56GgLP_cE'}]);
  }
  assert.deepEqual(youtubeIds('https://youtu.be/AbCdEfG123_'),['AbCdEfG123_']);
  assert.deepEqual(sharedYouTubeItems('UPLOAD devotion | Puja | https://youtu.be/HI56GgLP_cE'),[]);
});
test('playlists and channel-live shares stay links rather than forwarded text',()=>{
  const playlist='PL2YD1vkcVp_v1Lj6ysv6UsKi4TCfYZ4OL';
  assert.deepEqual(youtubeLinks('https://youtube.com/playlist?list='+playlist),[{youtubePlaylistId:playlist}]);
  assert.deepEqual(youtubeLinks('https://www.youtube.com/embed/videoseries?list='+playlist),[{youtubePlaylistId:playlist}]);
  assert.deepEqual(youtubeLinks('https://www.youtube.com/@Swamiji/live?si=share'),[{youtubeLivePath:'/@Swamiji/live'}]);
  assert.deepEqual(youtubeLinks('https://youtu.be/HI56GgLP_cE https://youtube.com/live/HI56GgLP_cE'),[{youtubeId:'HI56GgLP_cE'}]);
  for(const url of ['https://youtube.com.evil.test/live/HI56GgLP_cE','https://evil.test@youtube.com/live/HI56GgLP_cE','https://youtube.com:8443/live/HI56GgLP_cE','https://youtube.com/playlist?list=../../secret','https://example.com/@name/live'])assert.deepEqual(youtubeLinks(url),[]);
});
