"use strict";var q=Object.create;var b=Object.defineProperty;var z=Object.getOwnPropertyDescriptor;var V=Object.getOwnPropertyNames;var Y=Object.getPrototypeOf,G=Object.prototype.hasOwnProperty;var K=(t,s)=>{for(var e in s)b(t,e,{get:s[e],enumerable:!0})},I=(t,s,e,i)=>{if(s&&typeof s=="object"||typeof s=="function")for(let n of V(s))!G.call(t,n)&&n!==e&&b(t,n,{get:()=>s[n],enumerable:!(i=z(s,n))||i.enumerable});return t};var r=(t,s,e)=>(e=t!=null?q(Y(t)):{},I(s||!t||!t.__esModule?b(e,"default",{value:t,enumerable:!0}):e,t)),Q=t=>I(b({},"__esModule",{value:!0}),t);var is={};K(is,{activate:()=>es,deactivate:()=>ts});module.exports=Q(is);var y=r(require("vscode")),T=r(require("fs"));var u=r(require("vscode")),C=r(require("path")),m=r(require("fs")),$=r(require("os"));var d=r(require("fs")),f=r(require("path")),_=r(require("os")),S=f.join(_.homedir(),".claude");function X(){let t=new Map,s=f.join(S,"history.jsonl");if(!d.existsSync(s))return t;let e=d.readFileSync(s,"utf8").split(`
`).filter(Boolean);for(let i of e)try{let n=JSON.parse(i);n.sessionId&&n.display&&t.set(n.sessionId,n.display)}catch{}return t}function Z(t){try{let s=d.readFileSync(t,"utf8").split(`
`).filter(Boolean);for(let e of s)try{let i=JSON.parse(e);if(i.type==="user"&&i.message?.role==="user"){let n=i.message.content;if(Array.isArray(n)){let a=n.find(o=>o.type==="text");if(a?.text)return a.text.slice(0,120)}else if(typeof n=="string")return n.slice(0,120)}}catch{}}catch{}return""}function M(){let t=f.join(S,"usage-data","session-meta"),s=X(),e=new Set,i=[];if(d.existsSync(t)){let a=d.readdirSync(t).filter(o=>o.endsWith(".json"));for(let o of a)try{let l=d.readFileSync(f.join(t,o),"utf8"),p=JSON.parse(l),g=p.session_id??o.replace(".json","");e.add(g);let x=s.get(g)??p.first_prompt??"";i.push({sessionId:g,firstPrompt:x.slice(0,120),startTime:p.start_time??"",durationMinutes:p.duration_minutes??0,userMessageCount:p.user_message_count??0,assistantMessageCount:p.assistant_message_count??0})}catch{}}let n=f.join(S,"projects","C--Users-I327394");if(d.existsSync(n)){let a=d.readdirSync(n).filter(o=>o.endsWith(".jsonl")&&!e.has(o.replace(".jsonl","")));for(let o of a){let l=o.replace(".jsonl",""),p=f.join(n,o);try{let x=d.statSync(p).mtime.toISOString(),L=s.get(l)??Z(p);i.push({sessionId:l,firstPrompt:L.slice(0,120),startTime:x,durationMinutes:0,userMessageCount:0,assistantMessageCount:0})}catch{}}}return i.sort((a,o)=>a.startTime?o.startTime?o.startTime.localeCompare(a.startTime):-1:1),i}function j(){return f.join(S,"usage-data","session-meta")}var h=r(require("fs")),F=r(require("path")),U=r(require("os")),B=r(require("crypto")),w=F.join(U.homedir(),".claude","taskboard.json"),D=["#4CAF50","#2196F3","#FF9800","#E91E63","#9C27B0","#00BCD4","#FF5722","#607D8B"];function c(){if(!h.existsSync(w))return{tasks:[]};try{return JSON.parse(h.readFileSync(w,"utf8"))}catch{return{tasks:[]}}}function v(t){h.writeFileSync(w,JSON.stringify(t,null,2),"utf8")}function P(t,s){let e=c(),i=e.tasks.length%D.length,n={id:B.randomUUID(),name:t,color:s??D[i],status:"active",createdAt:new Date().toISOString(),sessions:[]};return e.tasks.unshift(n),v(e),n}function A(t,s,e){let i=c(),n=i.tasks.find(a=>a.id===t);n&&(n.sessions.some(a=>a.sessionId===s)||(n.sessions.unshift({sessionId:s,label:e,addedAt:new Date().toISOString()}),v(i)))}function W(t,s){let e=c(),i=e.tasks.find(n=>n.id===t);i&&(i.sessions=i.sessions.filter(n=>n.sessionId!==s),v(e))}function O(t){let s=c(),e=s.tasks.find(i=>i.id===t);e&&(e.status="archived",v(s))}function H(t){let s=c(),e=s.tasks.find(i=>i.id===t);e&&(e.status="active",v(s))}function E(t){let s=c();s.tasks=s.tasks.filter(e=>e.id!==t),v(s)}function N(t,s,e){let i=c(),n=i.tasks.find(o=>o.id===t);if(!n)return;let a=n.sessions.find(o=>o.sessionId===s);a&&(a.label=e,v(i))}function J(t,s){let e=c(),i=e.tasks.find(n=>n.id===t);i&&(i.headerContent=s,v(e))}function R(){let t=c(),s=new Set;for(let e of t.tasks)for(let i of e.sessions)s.add(i.sessionId);return s}var k=class{constructor(s){this._extensionUri=s}static{this.viewType="claudeTaskboard.taskBoard"}resolveWebviewView(s,e,i){this._view=s,s.webview.options={enableScripts:!0,localResourceRoots:[this._extensionUri]},s.webview.html=this._getHtml(s.webview),this._setMessageHandler(s.webview),this._sendData(s.webview)}refresh(){this._view&&this._sendData(this._view.webview)}_sendData(s){let e=c(),i=M(),n=R(),a=i.filter(l=>!n.has(l.sessionId)),o={};i.forEach(l=>{o[l.sessionId]=l}),s.postMessage({type:"data",board:e,unassigned:a,sessionMap:o})}_setMessageHandler(s){s.onDidReceiveMessage(e=>{switch(e.type){case"createTask":P(e.name,e.color);break;case"assignSession":A(e.taskId,e.sessionId,e.label);break;case"removeSession":W(e.taskId,e.sessionId);break;case"archiveTask":O(e.taskId);break;case"unarchiveTask":H(e.taskId);break;case"deleteTask":E(e.taskId);break;case"renameSession":N(e.taskId,e.sessionId,e.label);break;case"updateTaskHeader":J(e.taskId,e.headerContent);break;case"resumeSession":this._resumeSession(e.sessionId);return;case"newSession":this._newSession(e.taskId);return;case"refresh":break}this._sendData(s)})}_resumeSession(s){let e=u.Uri.parse(`vscode://anthropic.claude-code/open?session=${s}`);u.env.openExternal(e)}_newSession(s){const activate=(cb)=>{const ext=u.extensions.getExtension("anthropic.claude-code");if(ext&&!ext.isActive){ext.activate().then(cb,cb);}else{cb();}};if(!s){activate(()=>u.commands.executeCommand("claude-vscode.editor.open"));return}let i=c().tasks.find(o=>o.id===s);if(!i)return;const projDir=C.join($.homedir(),".claude","projects","C--Users-I327394");const existingIds=new Set(m.existsSync(projDir)?m.readdirSync(projDir).filter(x=>x.endsWith(".jsonl")).map(x=>x.replace(".jsonl","")):[]); const webview=this._view?.webview;activate(()=>{u.commands.executeCommand("claude-vscode.newConversation");let elapsed=0;const poll=setInterval(()=>{elapsed+=1500;try{if(m.existsSync(projDir)){const newFile=m.readdirSync(projDir).filter(x=>x.endsWith(".jsonl")).find(x=>!existingIds.has(x.replace(".jsonl","")));if(newFile){A(s,newFile.replace(".jsonl",""),null);clearInterval(poll);if(webview)this._sendData(webview);}}}catch{}if(elapsed>=60000)clearInterval(poll);},1500);});}_getHtml(s){let e=s.asWebviewUri(u.Uri.joinPath(this._extensionUri,"media","main.js")),i=s.asWebviewUri(u.Uri.joinPath(this._extensionUri,"media","style.css")),n=ss();return`<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${s.cspSource} 'unsafe-inline'; script-src 'nonce-${n}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${i}" rel="stylesheet">
  <title>Claude \u4EFB\u52A1\u677F</title>
</head>
<body>
  <div id="app">
    <div id="toolbar">
      <span id="title">Claude \u4EFB\u52A1\u677F</span>
      <button id="newSessionBtn" class="btn-ghost" title="\u65B0\u5EFA Claude Session">\uFF0B Session</button>
      <button id="newTaskBtn" class="btn-primary" title="\u65B0\u5EFA\u4EFB\u52A1">\uFF0B \u4EFB\u52A1</button>
    </div>

    <div id="newTaskForm" class="hidden">
      <input id="newTaskName" type="text" placeholder="\u4EFB\u52A1\u540D\u79F0..." maxlength="60">
      <div id="colorPicker"></div>
      <div class="form-actions">
        <button id="createTaskBtn" class="btn-primary">\u521B\u5EFA</button>
        <button id="cancelTaskBtn" class="btn-ghost">\u53D6\u6D88</button>
      </div>
    </div>

    <div id="activeTasks"></div>

    <div id="archivedSection">
      <div id="archivedHeader" class="section-header collapsed" data-section="archived">
        <span class="chevron">\u25B6</span>
        <span>\u5DF2\u5F52\u6863</span>
        <span id="archivedCount" class="badge">0</span>
      </div>
      <div id="archivedTasks" class="hidden"></div>
    </div>

    <div id="unassignedSection">
      <div id="unassignedHeader" class="section-header" data-section="unassigned">
        <span class="chevron expanded">\u25BC</span>
        <span>\u672A\u5206\u914D Sessions</span>
        <span id="unassignedCount" class="badge">0</span>
        <input id="searchInput" type="text" placeholder="\u641C\u7D22..." class="search-box" onclick="event.stopPropagation()">
      </div>
      <div id="unassignedList"></div>
    </div>
  </div>
  <script nonce="${n}" src="${e}"></script>
</body>
</html>`}};function ss(){let t="",s="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";for(let e=0;e<32;e++)t+=s.charAt(Math.floor(Math.random()*s.length));return t}function es(t){let s=new k(t.extensionUri);t.subscriptions.push(y.window.registerWebviewViewProvider(k.viewType,s,{webviewOptions:{retainContextWhenHidden:!0}})),t.subscriptions.push(y.commands.registerCommand("claudeTaskboard.refresh",()=>{s.refresh()}));let e=j();if(T.existsSync(e)){let i=T.watch(e,()=>{s.refresh()});t.subscriptions.push({dispose:()=>i.close()})}}function ts(){}0&&(module.exports={activate,deactivate});
