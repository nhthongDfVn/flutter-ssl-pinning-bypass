/**

A Frida script that disables Flutter's TLS verification

This script works on Android x86, Android x64 and iOS x64. It uses pattern matching to find [ssl_verify_peer_cert in handshake.cc](https://github.com/google/boringssl/blob/master/ssl/handshake.cc#L323)

If the script doesn't work, take a look at https://github.com/NVISOsecurity/disable-flutter-tls-verification#warning-what-if-this-script-doesnt-work 


*/

// Configuration object containing patterns to locate the ssl_verify_peer_cert function
// for different platforms and architectures.
var config = {
    "ios":{
        "modulename": "Flutter",
        "patterns":{
            "arm64": [
                "FF 83 01 D1 FA 67 01 A9 F8 5F 02 A9 F6 57 03 A9 F4 4F 04 A9 FD 7B 05 A9 FD 43 01 91 F? 03 00 AA ?? 0? 40 F9 ?8 1? 40 F9 15 ?? 4? F9 B5 00 00 B4",
            ],
        },
    },
    "android":{
        "modulename": "libflutter.so",
        "patterns":{
            "arm64": [
                "F? 0F 1C F8 F? 5? 01 A9 F? 5? 02 A9 F? ?? 03 A9 ?? ?? ?? ?? 68 1A 40 F9",
                "F? 43 01 D1 FE 67 01 A9 F8 5F 02 A9 F6 57 03 A9 F4 4F 04 A9 13 00 40 F9 F4 03 00 AA 68 1A 40 F9",
                "FF 43 01 D1 FE 67 01 A9 ?? ?? 06 94 ?? 7? 06 94 68 1A 40 F9 15 15 41 F9 B5 00 00 B4 B6 4A 40 F9",
            ],
            "arm": [
                "2D E9 F? 4? D0 F8 00 80 81 46 D8 F8 18 00 D0 F8 ??",
            ],
            "x64": [
                "55 41 57 41 56 41 55 41 54 53 50 49 89 f? 4c 8b 37 49 8b 46 30 4c 8b a? ?? 0? 00 00 4d 85 e? 74 1? 4d 8b",
                "55 41 57 41 56 41 55 41 54 53 48 83 EC 18 49 89 FF 48 8B 1F 48 8B 43 30 4C 8B A0 28 02 00 00 4D 85 E4 74",
                "55 41 57 41 56 41 55 41 54 53 48 83 EC 38 C6 02 50 48 8B AF A8 00 00 00 48 85 ED 74 70 48 83 7D 00 00 74"
            ]
        }
    }
};

// Flag to check if TLS validation has already been disabled
var TLSValidationDisabled = false;

// Check if Java environment is available (Android)
if (Java.available) {
    console.log("[+] Java environment detected");
    Java.perform(hookSystemLoadLibrary);
// Check if ObjC environment is available (iOS)
} else if (ObjC.available) {
    console.log("[+] iOS environment detected");
}

// Attempt to disable TLS validation immediately and then again after a 2 second delay
disableTLSValidation();
setTimeout(disableTLSValidation, 5000, true);

// Hook the system load library method to detect when libflutter.so is loaded on Android
function hookSystemLoadLibrary() {
    const System = Java.use('java.lang.System');
    const Runtime = Java.use('java.lang.Runtime');
    const SystemLoad_2 = System.loadLibrary.overload('java.lang.String');
    const VMStack = Java.use('dalvik.system.VMStack');

    SystemLoad_2.implementation = function(library) {
        try {
            const loaded = Runtime.getRuntime().loadLibrary0(VMStack.getCallingClassLoader(), library);
            if (library === 'flutter') {
                console.log("[+] libflutter.so loaded");
                disableTLSValidation();
            }
            return loaded;
        } catch (ex) {
            console.log(ex);
        }
    };
}

// Main function to disable TLS validation for Flutter
function disableTLSValidation(fallback=false) {
    if (TLSValidationDisabled) return;

    var platformConfig = config[Java.available ? "android" : "ios"];
    var m = Process.findModuleByName(platformConfig["modulename"]);

    // If there is no loaded Flutter module, the setTimeout may trigger a second time, but after that we give up
    if (m === null) {
        if (fallback) console.log("[!] Flutter module not found.");
        return;
    }

    if (Process.arch in platformConfig["patterns"])
    {
        console.log("[+] Flutter library found");
        var patterns = platformConfig["patterns"][Process.arch]
        patterns.forEach(pattern => {
                var res = Memory.scan(m.base, m.size, pattern, {
                onMatch: function(address, size){
                    console.log('[+] Match pattern: ' + pattern)
                    console.log('[+] ssl_verify_result found at: ' + address.toString());

                    console.log('[+] ssl_verify_peer_cert found at offset: 0x' + (address - m.base).toString(16));
                    TLSValidationDisabled = true;
                    var thumb = Java.available && Process.arch == "arm" ? 1 : 0
                    hook_ssl_verify_peer_cert(address.add(thumb));
                    console.log("[+] Hook success!");

                    },
                onError: function(reason){
                    console.log('[!] There was an error scanning memory: ' + reason);
                    },
                    onComplete: function()
                    {
                    console.log("[+] Done")
                    }
                });
            });
    }
    else
    {
        console.log("[!] Processor architecture not supported: ", Process.arch);
    }

    if (!TLSValidationDisabled)
    {
        if (fallback){
            if(m.enumerateRanges('r-x').length == 0)
            {
                console.log('[!] No memory ranges found in Flutter library. This is either a Frida bug, or the application is using some kind of RASP. Try using Frida as a Gadget or using an older Android version (https://github.com/frida/frida/issues/2266)');
            }
            else
            {
                console.log('[!] ssl_verify_peer_cert not found. Please open an issue at https://github.com/NVISOsecurity/disable-flutter-tls-verification/issues');
            }
        }
        else
        {
            console.log('[!] ssl_verify_peer_cert not found. Trying again...');
        }
    }
}


// Replace the target function's implementation to effectively disable the TLS check
function hook_ssl_verify_peer_cert(address) {
    Interceptor.replace(address, new NativeCallback((pathPtr, flags) => {
        return 0;
    }, 'int', ['pointer', 'int']));
}
