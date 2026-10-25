import {useRef,useState} from 'react';
import {strFromU8,unzipSync} from 'fflate';

const STORAGE='macos27-nev-packages';
const readInstalled=()=>{try{return JSON.parse(localStorage.getItem(STORAGE)||'[]')}catch{return []}};
const textFile=(files,path)=>{const v=files[path];if(!v)return '';try{return strFromU8(v)}catch{return ''}};
const toDataUrl=(bytes,path)=>{const ext=(path.split('.').pop()||'').toLowerCase();const mime=({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',svg:'image/svg+xml',ico:'image/x-icon'})[ext]||'application/octet-stream';let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return 'data:'+mime+';base64,'+btoa(binary)};
const parseMeta=raw=>{try{return JSON.parse(raw)}catch{}const out={};const source=String(raw||'').replace(/\r/g,' ').replace(/\n/g,' ');const keys=['nombre','name','title','app','aplicacion','aplicación','logo','icon','icono','image','entrada','entry','main','index','start','archivo principal','formato','format','descripcion','description','resumen','summary'];const keyPattern=keys.sort((a,b)=>b.length-a.length).join('|');const re=new RegExp('(?:^|\\s)('+keyPattern+')\\s*:\\s*(.*?)(?=\\s+(?:'+keyPattern+')\\s*:|$)','gi');let m;while((m=re.exec(source))){out[m[1].trim().toLowerCase()]=m[2].trim()}if(!Object.keys(out).length){for(const line of source.split(/\r?\n/)){const m=line.match(/^\s*([^:#]+)\s*:\s*(.*?)\s*$/);if(m)out[m[1].trim().toLowerCase()]=m[2].trim()}}return out};
const normalize=(archiveFiles)=>{
 let files=Object.fromEntries(Object.entries(archiveFiles).filter(([path])=>!path.split('/').some(part=>part==='__MACOSX'||part==='.DS_Store'||part.startsWith('._'))));
 const initialPaths=Object.keys(files).filter(p=>!p.endsWith('/'));
 const roots=[...new Set(initialPaths.map(p=>p.split('/')[0]))];
 if(roots.length===1&&roots[0].toLowerCase()!=='sources'&&initialPaths.every(p=>p.includes('/'))){const root=roots[0]+'/';const stripped={};for(const path of initialPaths)stripped[path.slice(root.length)]=files[path];files=stripped}
 const paths=Object.keys(files).filter(p=>!p.endsWith('/'));
 const metaPath=paths.find(p=>/^sources\/appe-data\.txt$/i.test(p))||paths.find(p=>/^(package|manifest|info)\.(nev|json|txt)$/i.test(p.split('/').pop()))||paths.find(p=>/appe-data\.txt$/i.test(p));
 const raw=metaPath?textFile(files,metaPath):'';
 const meta=parseMeta(raw);
 const pick=(...keys)=>{for(const key of keys){const found=Object.keys(meta).find(k=>k.toLowerCase()===key.toLowerCase());if(found&&meta[found]!=null&&String(meta[found]).trim())return String(meta[found]).trim()}return ''};
 const entry=pick('entrada','entry','main','index','start','archivo principal')||['App.jsx','sources/App.jsx','index.html','sources/index.html','main.html','sources/main.html','App.html','sources/App.html'].find(p=>files[p])||'';
 const format=pick('formato','format')||'nev-1.0';
 const name=pick('nombre','name','title','app','aplicacion','aplicación')||'Aplicación .nev';
 if(format.toLowerCase()!=='nev-1.0')throw Error('formato no compatible: '+format+' (se esperaba nev-1.0)');
 if(!entry)throw Error('no se encontró una entrada ejecutable; incluye index.html o indica entrada en sources/appe-data.txt');
 const sourcePrefix=paths.some(p=>p.startsWith('sources/'))?'sources/':'';
 const entryPath=paths.includes(entry)?entry:paths.includes(sourcePrefix+entry)?sourcePrefix+entry:paths.find(p=>p.toLowerCase()===entry.toLowerCase())||paths.find(p=>p.toLowerCase()===(sourcePrefix+entry).toLowerCase());
 if(!entryPath||!files[entryPath])throw Error('no se encuentra el archivo de entrada '+entry);
 const logoValue=pick('logo','icon','icono','image')||'sources/appe-logo.png';
 const logoPath=paths.includes(logoValue)?logoValue:paths.includes(sourcePrefix+logoValue)?sourcePrefix+logoValue:paths.find(p=>p.toLowerCase()===logoValue.toLowerCase())||'';

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
 const description=pick('descripcion','description','resumen','summary')||'aplicacion instalada desde paquete .nev';
 const isHtml=/\.html?$/i.test(entryPath);const isJsx=/\.(jsx|tsx)$/i.test(entryPath);
 if(isHtml){
  let html=savedFiles[entryPath]||'';
  const base=entryPath.includes('/')?entryPath.slice(0,entryPath.lastIndexOf('/')+1):'';
  const resolvePath=src=>{const clean=decodeURIComponent(String(src||'').split(/[?#]/)[0]);if(!clean||/^(https?:|data:|blob:|#|\/\/)/i.test(clean))return null;const joined=(clean.startsWith('/')?'':base)+clean;const parts=[];for(const part of joined.split('/')){if(part==='.'||!part)continue;if(part==='..')parts.pop();else parts.push(part)}const normalized=parts.join('/');return savedFiles[normalized]?normalized:(savedFiles[clean]?clean:null)};
  html=html.replace(/<link\b([^>]*?)href=(["'])([^"']+)\2([^>]*)>/gi,(tag,before,q,href,after)=>{if(!/stylesheet/i.test(before+' '+after))return tag;const path=resolvePath(href);return path?'<style>'+String(savedFiles[path]).replace(/<\/style/gi,'<\\/style')+'</style>':tag});
  html=html.replace(/<script\b([^>]*?)src=(["'])([^"']+)\2([^>]*)>\s*<\/script>/gi,(tag,attrs,q,src,tail)=>{const path=resolvePath(src);if(!path)return tag;const code=String(savedFiles[path]);return '<script'+attrs+tail+'>'+code.replace(/<\/script/gi,'<\\/script')+'</script>'});
  html=html.replace(/\b(src|href)=(["'])([^"']+)\2/gi,(attr,kind,q,value)=>{const path=resolvePath(value);if(!path)return attr;const ext=path.split('.').pop().toLowerCase();if(kind.toLowerCase()==='href'&&!['png','jpg','jpeg','gif','webp','svg','ico','woff','woff2','ttf'].includes(ext))return attr;const data=savedFiles[path];return data&&String(data).startsWith('data:')?kind+'='+q+data+q:attr});
  savedFiles[entryPath]=html;
 }
 const logo=logoPath?(savedFiles[logoPath]||''):'';
 return {id:'nev-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),name:String(name),logo,entry:entryPath,format:'nev-1.0',files:savedFiles,installedAt:new Date().toISOString(),description:String(description),launchable:isHtml||isJsx};
};

export default function NevInstaller({packages,onPackagesChange,onLaunch}){
 const input=useRef(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
 const install=async file=>{
  setBusy(true);setError('');setMessage('');
  try{
   if(!/\.(nev|zip)$/i.test(file.name))throw Error('selecciona un paquete .nev o un archivo .zip');
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
  <div className="nev-drop"><div className="nev-file-icon">⇧</div><h2>instala un paquete</h2><p>selecciona un paquete .nev o un .zip que contenga el manifiesto y la carpeta sources/</p><button className="mac-button" disabled={busy} onClick={()=>input.current?.click()}>{busy?'Instalando…':'Seleccionar archivo .nev / .zip'}</button><input ref={input} type="file" accept=".nev,.zip,application/zip,application/x-zip-compressed,application/octet-stream" hidden onChange={e=>{const file=e.target.files?.[0];if(file)install(file)}}/><small>maximo 8 MB comprimido · 5 MB descomprimido</small></div>
  {error&&<div className="nev-alert error">{error}</div>}{message&&<div className="nev-alert">{message}</div>}
  <div className="nev-format"><b>estructura del paquete</b><pre>{'sources/\n  appe-data.txt  → nombre: Spotify logo: sources/appe-logo.png entrada: App.jsx formato: nev-1.0\n  appe-logo.png\n  App.jsx'}</pre></div>
  <div className="nev-installed-head"><h2>paquetes instalados</h2><span>{packages.length}</span></div>
  {packages.length===0?<div className="nev-empty">todavia no has instalado ningun paquete .nev</div>:<div className="nev-package-list">{packages.map(p=><article key={p.id}>{p.logo?<img src={p.logo} alt=""/>:<div className="nev-package-logo">NEV</div>}<div className="nev-package-info"><b>{p.name}</b><small>{p.entry} · {p.format}</small><small>{p.description}</small></div><div className="nev-package-actions"><button className="get-button" onClick={()=>onLaunch(p)}>{p.launchable?'ABRIR':'ARCHIVOS'}</button><button className="nev-remove" onClick={()=>remove(p.id)}>Desinstalar</button></div></article>)}</div>}
  <p className="nev-security">los paquetes se guardan en este navegador. las entradas JSX se renderizan en un entorno aislado con React y Babel; necesitan conexion a internet para cargar el runtime. las entradas HTML tambien se abren en un entorno aislado</p>
 </div>;
}
