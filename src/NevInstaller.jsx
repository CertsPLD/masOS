import {useRef,useState} from 'react';
import {strFromU8,unzipSync} from 'fflate';

const STORAGE='macos27-nev-packages';
const readInstalled=()=>{try{return JSON.parse(localStorage.getItem(STORAGE)||'[]')}catch{return []}};
const textFile=(files,path)=>{const v=files[path];if(!v)return '';try{return strFromU8(v)}catch{return ''}};
const toDataUrl=(bytes,path)=>{const ext=(path.split('.').pop()||'').toLowerCase();const mime=({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',svg:'image/svg+xml',ico:'image/x-icon'})[ext]||'application/octet-stream';let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return 'data:'+mime+';base64,'+btoa(binary)};
const parseMeta=raw=>{try{return JSON.parse(raw)}catch{}const out={};for(const line of raw.split(/\r?\n/)){const m=line.match(/^\s*([^:#]+)\s*:\s*(.*?)\s*$/);if(m)out[m[1].trim().toLowerCase()]=m[2].trim()}return out};
const normalize=(archiveFiles)=>{
 let files=Object.fromEntries(Object.entries(archiveFiles).filter(([path])=>!path.split('/').some(part=>part==='__MACOSX'||part==='.DS_Store'||part.startsWith('._'))));
 const initialPaths=Object.keys(files).filter(p=>!p.endsWith('/'));
 const roots=[...new Set(initialPaths.map(p=>p.split('/')[0]))];
 if(roots.length===1&&roots[0].toLowerCase()!=='sources'&&initialPaths.every(p=>p.includes('/'))){const root=roots[0]+'/';const stripped={};for(const path of initialPaths)stripped[path.slice(root.length)]=files[path];files=stripped}
 const paths=Object.keys(files).filter(p=>!p.endsWith('/'));
 const metaPath=paths.find(p=>/^sources\/appe-data\.txt$/i.test(p))||paths.find(p=>/^(package|manifest|info)\.(nev|json|txt)$/i.test(p.split('/').pop()));
 const raw=metaPath?textFile(files,metaPath):'';
 const meta=parseMeta(raw);
 const name=meta.nombre||meta.name||meta.title;
 const entry=meta.entrada||meta.entry||meta.main||'App.jsx';
 const format=meta.formato||meta.format;
 if(!name)throw Error('falta «nombre» en el manifiesto del paquete');
 if(format!=='nev-1.0')throw Error('formato no compatible: se esperaba nev-1.0');
 const sourcePrefix=paths.some(p=>p.startsWith('sources/'))?'sources/':'';
 const entryPath=entry.startsWith('sources/')?entry:sourcePrefix+entry;
 if(!files[entryPath])throw Error('no se encuentra el archivo de entrada '+entryPath);
 const logoValue=meta.logo||'sources/appe-logo.png';
 const logoPath=logoValue.startsWith('sources/')?logoValue:sourcePrefix+logoValue;
 const logo=logoPath&&files[logoPath]?toDataUrl(files[logoPath],logoPath):'';
 const savedFiles={};
 let total=0;
 for(const path of paths){
  if(path.split('/').some(part=>part==='..'))throw Error('el paquete contiene una ruta no permitida');
  const bytes=files[path];total+=bytes.length;
  if(total>5*1024*1024)throw Error('el paquete descomprimido supera el limite de 5 MB');
  const ext=(path.split('.').pop()||'').toLowerCase();
  if(['jsx','js','tsx','ts','json','css','html','txt','md','svg','xml','yml','yaml','csv'].includes(ext)){try{savedFiles[path]=strFromU8(bytes)}catch{savedFiles[path]=toDataUrl(bytes,path)}}
  else savedFiles[path]=toDataUrl(bytes,path);
 }
 if(!savedFiles[entryPath])savedFiles[entryPath]=textFile(files,entryPath);
 return {id:'nev-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),name:String(name),logo,entry:entryPath,format:'nev-1.0',files:savedFiles,installedAt:new Date().toISOString(),description:String(meta.descripcion||meta.description||'paquete .nev instalado'),launchable: /\.html?$/i.test(entryPath)};
};

export default function NevInstaller({packages,onPackagesChange,onLaunch}){
 const input=useRef(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
 const install=async file=>{
  setBusy(true);setError('');setMessage('');
  try{
   if(!file.name.toLowerCase().endsWith('.nev'))throw Error('selecciona un archivo con extension .nev');
   if(file.size>8*1024*1024)throw Error('el archivo supera el limite de 8 MB');
   const bytes=new Uint8Array(await file.arrayBuffer());
   const unpacked=unzipSync(bytes);
   const pkg=normalize(unpacked);
   const current=readInstalled();
   const next=[...current.filter(p=>p.name.toLowerCase()!==pkg.name.toLowerCase()),pkg];
   const encoded=JSON.stringify(next);
   try{localStorage.setItem(STORAGE,encoded)}catch{throw Error('no hay suficiente espacio local para guardar este paquete')}
   onPackagesChange(next);setMessage(pkg.name+' se ha instalado correctamente');
  }catch(e){setError(e.message||'no se pudo instalar el paquete')}
  finally{setBusy(false);if(input.current)input.current.value=''}
 };
 const remove=id=>{const next=packages.filter(p=>p.id!==id);localStorage.setItem(STORAGE,JSON.stringify(next));onPackagesChange(next);setMessage('paquete desinstalado');setError('')};
 return <div className="nev-installer">
  <div className="nev-hero"><div className="nev-mark">NEV</div><div><small>GESTOR DE PAQUETES</small><h1>instalador .nev</h1><p>instala aplicaciones empaquetadas para masOS</p></div></div>
  <div className="nev-drop"><div className="nev-file-icon">⇧</div><h2>instala un paquete</h2><p>selecciona un archivo .nev empaquetado como ZIP, con el manifiesto y la carpeta sources/</p><button className="mac-button" disabled={busy} onClick={()=>input.current?.click()}>{busy?'Instalando…':'Seleccionar paquete .nev'}</button><input ref={input} type="file" accept=".nev,application/zip" hidden onChange={e=>{const file=e.target.files?.[0];if(file)install(file)}}/><small>maximo 8 MB comprimido · 5 MB descomprimido</small></div>
  {error&&<div className="nev-alert error">{error}</div>}{message&&<div className="nev-alert">{message}</div>}
  <div className="nev-format"><b>estructura compatible</b><pre>{'sources/appe-data.txt\nnombre: Spotify\nlogo: sources/appe-logo.png\nentrada: App.jsx\nformato: nev-1.0\nsources/\n  appe-data.txt\n  appe-logo.png\n  App.jsx\n  ...'}</pre><small>el manifiesto principal es sources/appe-data.txt y el logo predeterminado es sources/appe-logo.png</small></div>
  <div className="nev-installed-head"><h2>paquetes instalados</h2><span>{packages.length}</span></div>
  {packages.length===0?<div className="nev-empty">todavia no has instalado ningun paquete .nev</div>:<div className="nev-package-list">{packages.map(p=><article key={p.id}>{p.logo?<img src={p.logo} alt=""/>:<div className="nev-package-logo">NEV</div>}<div className="nev-package-info"><b>{p.name}</b><small>{p.entry} · {p.format}</small><small>{p.description}</small></div><div className="nev-package-actions"><button className="get-button" onClick={()=>onLaunch(p)}>{p.launchable?'ABRIR':'ARCHIVOS'}</button><button className="nev-remove" onClick={()=>remove(p.id)}>Desinstalar</button></div></article>)}</div>}
  <p className="nev-security">los paquetes se guardan en este navegador. las entradas JSX se instalan como archivos fuente; para ejecutarlas como apps React, el paquete necesita una compilacion compatible. las entradas HTML se pueden abrir en un entorno aislado</p>
 </div>;
}
