import {readFile,writeFile} from 'node:fs/promises';
const input=await readFile(new URL('../docs/使用手册.md',import.meta.url),'utf8');
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const html=input.trim().split(/\n\n+/).map(block=>{if(block.startsWith('# '))return '<h1>'+escape(block.slice(2))+'</h1>';if(block.startsWith('## '))return '<h2>'+escape(block.slice(3))+'</h2>';if(block.startsWith('- '))return '<ul>'+block.split('\n').map(l=>'<li>'+escape(l.replace(/^- /,''))+'</li>').join('')+'</ul>';return '<p>'+escape(block)+'</p>';}).join('\n');
await writeFile(new URL('../dist/manual.html',import.meta.url),'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>读懂岗位 · 使用手册</title><link rel="stylesheet" href="manual.css"><main><a href="/">← 返回读懂岗位</a>'+html+'</main></html>');
