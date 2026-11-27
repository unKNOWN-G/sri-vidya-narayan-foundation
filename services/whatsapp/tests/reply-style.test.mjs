import test from 'node:test';
import assert from 'node:assert/strict';
import {formatReply} from '../reply-style.mjs';

test('assistant menus have a bold sender label and a different native text style',()=>{
  const result=formatReply('Which section?\n1. Education\nB. Back');
  assert.ok(result.startsWith('*Website Assistant*\n\n```\n'));
  assert.ok(result.endsWith('\n```'));assert.ok(result.includes('B. Back'));
});
test('the published link remains outside monospace and independently clickable',()=>{
  const url='https://unknown-g.github.io/sri-vidya-narayan-foundation/#/event/example';
  const result=formatReply('Published successfully.\n'+url+'\nSend REDO to edit.');
  const segments=result.split('```');assert.ok(segments[2].includes(url));
  assert.ok(!segments[1].includes(url));assert.ok(segments[3].includes('Send REDO'));
});
test('caption backticks cannot close the assistant style early',()=>{
  const input='Caption with ```literal ticks``` and *asterisks*.';
  const result=formatReply(input);assert.equal(result.split('```').length,3);
  assert.ok(result.includes('*asterisks*'));assert.equal(input,'Caption with ```literal ticks``` and *asterisks*.');
});
