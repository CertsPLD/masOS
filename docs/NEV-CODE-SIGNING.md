# Firma de paquetes .nev en masOS

masOS usa un esquema propio de firma de paquetes, independiente de Apple. La firma usa ECDSA P-256 con SHA-256.

## 1. Crear una identidad de desarrollador

Con Node.js instalado y las dependencias del proyecto disponibles:

```sh
npm install
npm run nev:cert -- --name "Nombre del desarrollador" --out ./keys/desarrollador
```

Se generan dos archivos:
- `keys/desarrollador.nevcert.json`: certificado publico que puedes distribuir.
- `keys/desarrollador.private.pem`: clave privada que firma los paquetes.

**No subas ni compartas la clave privada.** Guárdala fuera del repositorio, limita el acceso y conserva una copia segura.

## 2. Firmar un paquete

```sh
npm run nev:sign -- ./MiApp.nev --key ./keys/desarrollador.private.pem --cert ./keys/desarrollador.nevcert.json
```

El comando genera `MiApp.signed.nev`. La firma cubre las rutas y el contenido de todos los archivos del ZIP, excepto el propio archivo de firma.

## 3. Confiar en el desarrollador e instalar

1. Abre el Instalador .nev en masOS.
2. Importa el archivo publico `.nevcert.json` del desarrollador.
3. Comprueba que el nombre y la huella SHA-256 corresponden al desarrollador por un canal fiable.
4. Selecciona el paquete `.signed.nev`.

El instalador verifica la firma y rechaza paquetes sin firma, modificados o firmados por certificados que no estén en la lista local de confianza. Eliminar la confianza impide instalar nuevos paquetes firmados con ese certificado.

## Alcance y seguridad

- Es un sistema de firma propio de masOS, no un certificado Apple Enterprise ni la firma nativa de aplicaciones iOS.
- Importar un certificado equivale a confiar en ese desarrollador. Una firma válida demuestra integridad y posesión de la clave privada; no demuestra que la aplicación sea segura o benigna.
- La confianza se guarda en el almacenamiento local del navegador y no se sincroniza entre dispositivos o perfiles.
- Las aplicaciones .nev siguen ejecutándose en el runtime web de masOS. La firma no convierte JSX en una aplicación nativa ni elimina los riesgos del código que el usuario decide ejecutar.
