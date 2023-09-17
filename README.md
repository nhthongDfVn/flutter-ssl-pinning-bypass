# flutter-ssl-pinning-bypass
Custom script for bypass SSL Pinning

### Note
- Based on https://github.com/NVISOsecurity/disable-flutter-tls-verification
- When I executed the old script, I noticed the system returned the  error
```
[+] Java environment detected
[+] Flutter library found
[!] ssl_verify_peer_cert not found. Trying again...
[+] Flutter library found
[!] No memory ranges found in Flutter library. This is either a Frida bug, or the application is using some kind of RASP.
```
- I edited a few things and it worked again

### How to use
- Install Objection or Frida
- Run this command with Frida
```
frida -l custom-disable-flutter-tls.js  -Uf <package-name>
```
- or using Objection
```
objection -g <package-name> explore
import custom-disable-flutter-tls.js
```


