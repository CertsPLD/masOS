#!/usr/bin/env node
import { generateKeyPairSync, createHash, sign } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { strToU8, strFromU8, unzipSync, zipSync } from 'fflate';

const usage = () => {
  console.log('masOS .nev developer signing\n\nCreate certificate:\n  node scripts/nev-crypto.mjs create-cert --name "Developer" --out ./developer\n\nSign package:\n  node scripts/nev-crypto.mjs sign app.nev --key ./developer.private.pem --cert ./developer.nevcert.json');
};
const args = process.argv.slice(2);
const get = name => { const i=args.indexOf(name); return i>=0 ? args[i+1] : ''; };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const signaturePath = 'META-INF/masos-signature.json';
function payload(files) {
  return Buffer.from(Object.keys(files).filter(p=>!p.endsWith('/')&&p!==signaturePath).sort().map(p=>p+'\0'+digest(Buffer.from(files[p]))+'\n').join(''),'utf8');
}
if (args[0] === 'create-cert') {
  const name = get('--name');
  const out = get('--out') || './masos-developer';
  if (!name) { console.error('Falta --name'); process.exit(2); }
  const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicDer = pair.publicKey.export({type:'spki',format:'der'});
  const cert = {format:'masos-nev-cert-1',name,algorithm:'ECDSA-P256-SHA256',publicKey:publicDer.toString('base64'),fingerprint:digest(publicDer),createdAt:new Date().toISOString()};
  writeFileSync(resolve(out+'.private.pem'),pair.privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600});
  writeFileSync(resolve(out+'.nevcert.json'),JSON.stringify(cert,null,2)+'\n');
  console.log('Certificado publico:',resolve(out+'.nevcert.json'));
  console.log('Clave privada:',resolve(out+'.private.pem'));
  console.log('Fingerprint SHA-256:',cert.fingerprint);
  console.log('IMPORTANTE: no subas ni compartas la clave privada.');
} else if (args[0] === 'sign') {
  const input=args[1], keyPath=get('--key'), certPath=get('--cert');
  if(!input||!keyPath||!certPath){usage();process.exit(2);}
  const archive=unzipSync(new Uint8Array(readFileSync(input)));
  delete archive[signaturePath];
  const cert=JSON.parse(readFileSync(certPath,'utf8'));
  if(cert.format!=='masos-nev-cert-1'||cert.algorithm!=='ECDSA-P256-SHA256')throw Error('Certificado .nevcert no compatible');
  const privateKey=readFileSync(keyPath);
  const sig=sign('sha256',payload(archive),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64');
  archive[signaturePath]=strToU8(JSON.stringify({format:'masos-nev-signature-1',algorithm:'ECDSA-P256-SHA256',fingerprint:cert.fingerprint,certificate:cert,signature:sig,signedAt:new Date().toISOString()},null,2));
  const out=input.replace(/\.(nev|zip)$/i,'')+'.signed.nev';
  writeFileSync(out,zipSync(archive,{level:6}));
  console.log('Paquete firmado:',resolve(out));
  console.log('Certificado:',cert.name,'\nFingerprint:',cert.fingerprint);
} else usage();
