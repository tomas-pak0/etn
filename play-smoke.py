import subprocess,time,re,xml.etree.ElementTree as ET
def adb(*args):return subprocess.check_output(['adb',*args])
def dump():
    adb('shell','uiautomator','dump','/sdcard/ui.xml')
    xml=adb('shell','cat','/sdcard/ui.xml')
    open('evidence/last-ui.xml','wb').write(xml)
    return ET.fromstring(xml)
def tap(pattern):
    for node in dump().iter('node'):
        text=node.get('text','')+' '+node.get('content-desc','')
        if re.search(pattern,text,re.I):
            b=list(map(int,re.findall(r'\d+',node.get('bounds'))))
            adb('shell','input','tap',str((b[0]+b[2])//2),str((b[1]+b[3])//2));time.sleep(1);return True
    return False
def shot(name):
    open('evidence/'+name+'.png','wb').write(adb('exec-out','screencap','-p'))
def clear_system_dialogs():
    for _ in range(4):
        ui=dump();texts=' '.join(n.get('text','') for n in ui.iter('node'))
        if "ETN isn't responding" in texts:raise AssertionError('ETN ANR')
        if "Quickstep isn't responding" in texts:
            assert tap(r'^Close app\\s*('shell','input','swipe','540','1650','540','400','500');time.sleep(2)
shot('02-footer')
record=subprocess.Popen(['adb','shell','screenrecord','--time-limit','60','/sdcard/ETN-location-demo.mp4'])
assert tap(r'Start exploring|Pradėti tyrinėjimą|Start exploration'),'Start button missing'
shot('03-location-disclosure')
assert tap(r'^OK\s*$'),'Disclosure confirmation missing'
time.sleep(2)
shot('04-location-permission')
tap(r'While using the app|While using this app|Naudojant programėlę')
time.sleep(2)
tap(r'^Allow\s*$|^Leisti\s*$')
time.sleep(2)
adb('emu','geo','fix','25.2797','54.6872');time.sleep(4)
services=adb('shell','dumpsys','activity','services','lt.tyliaitpk.etn.next').decode()
open('evidence/services.txt','w').write(services)
assert 'isForeground=true' in services,'Location foreground service not running'
shot('05-exploring')
adb('shell','am','start','-a','android.settings.SETTINGS');time.sleep(2)
adb('shell','cmd','statusbar','expand-notifications');time.sleep(2)
shot('06-location-notification')
adb('shell','cmd','statusbar','collapse')
adb('shell','am','start','-n','lt.tyliaitpk.etn.next/lt.tyliaitpk.etn.MainActivity');time.sleep(2)
tap(r'Continue exploring|Tęsti tyrinėjimą')
assert tap(r'^Stop\s*$|^Stabdyti\s*$'),'Stop button missing'
services=adb('shell','dumpsys','activity','services','lt.tyliaitpk.etn.next').decode()
assert 'isForeground=true' not in services,'Location service did not stop'
record.wait(timeout=65)
adb('pull','/sdcard/ETN-location-demo.mp4','evidence/ETN-location-demo.mp4')
open('evidence/smoke-validation.txt','w').write('Android 15: launch, disclosure, permissions, foreground location start, background notification, stop passed. Coordinates simulated in emulator.\n')
);time.sleep(5)
        elif "isn't responding" in texts:
            assert tap(r'^Wait\\s*('shell','input','swipe','540','1650','540','400','500');time.sleep(2)
shot('02-footer')
record=subprocess.Popen(['adb','shell','screenrecord','--time-limit','60','/sdcard/ETN-location-demo.mp4'])
assert tap(r'Start exploring|Pradėti tyrinėjimą|Start exploration'),'Start button missing'
shot('03-location-disclosure')
assert tap(r'^OK\s*$'),'Disclosure confirmation missing'
time.sleep(2)
shot('04-location-permission')
tap(r'While using the app|While using this app|Naudojant programėlę')
time.sleep(2)
tap(r'^Allow\s*$|^Leisti\s*$')
time.sleep(2)
adb('emu','geo','fix','25.2797','54.6872');time.sleep(4)
services=adb('shell','dumpsys','activity','services','lt.tyliaitpk.etn.next').decode()
open('evidence/services.txt','w').write(services)
assert 'isForeground=true' in services,'Location foreground service not running'
shot('05-exploring')
adb('shell','input','keyevent','KEYCODE_HOME');time.sleep(2)
adb('shell','cmd','statusbar','expand-notifications');time.sleep(2)
shot('06-location-notification')
adb('shell','cmd','statusbar','collapse')
adb('shell','am','start','-n','lt.tyliaitpk.etn.next/lt.tyliaitpk.etn.MainActivity');time.sleep(2)
assert tap(r'^Stop\s*$|^Stabdyti\s*$'),'Stop button missing'
services=adb('shell','dumpsys','activity','services','lt.tyliaitpk.etn.next').decode()
assert 'isForeground=true' not in services,'Location service did not stop'
record.wait(timeout=65)
adb('pull','/sdcard/ETN-location-demo.mp4','evidence/ETN-location-demo.mp4')
open('evidence/smoke-validation.txt','w').write('Android 15: launch, disclosure, permissions, foreground location start, background notification, stop passed. Coordinates simulated in emulator.\n')
);time.sleep(10)
        else:return
    raise AssertionError('Android system remains unresponsive')
clear_system_dialogs()
shot('01-home')
for _ in range(2):adb('shell','input','swipe','540','1650','540','400','500');time.sleep(2)
shot('02-footer')
record=subprocess.Popen(['adb','shell','screenrecord','--time-limit','60','/sdcard/ETN-location-demo.mp4'])
assert tap(r'Start exploring|Pradėti tyrinėjimą|Start exploration'),'Start button missing'
shot('03-location-disclosure')
assert tap(r'^OK\s*$'),'Disclosure confirmation missing'
time.sleep(2)
shot('04-location-permission')
tap(r'While using the app|While using this app|Naudojant programėlę')
time.sleep(2)
tap(r'^Allow\s*$|^Leisti\s*$')
time.sleep(2)
adb('emu','geo','fix','25.2797','54.6872');time.sleep(4)
services=adb('shell','dumpsys','activity','services','lt.tyliaitpk.etn.next').decode()
open('evidence/services.txt','w').write(services)
assert 'isForeground=true' in services,'Location foreground service not running'
shot('05-exploring')
adb('shell','input','keyevent','KEYCODE_HOME');time.sleep(2)
adb('shell','cmd','statusbar','expand-notifications');time.sleep(2)
shot('06-location-notification')
adb('shell','cmd','statusbar','collapse')
adb('shell','am','start','-n','lt.tyliaitpk.etn.next/lt.tyliaitpk.etn.MainActivity');time.sleep(2)
assert tap(r'^Stop\s*$|^Stabdyti\s*$'),'Stop button missing'
services=adb('shell','dumpsys','activity','services','lt.tyliaitpk.etn.next').decode()
assert 'isForeground=true' not in services,'Location service did not stop'
record.wait(timeout=65)
adb('pull','/sdcard/ETN-location-demo.mp4','evidence/ETN-location-demo.mp4')
open('evidence/smoke-validation.txt','w').write('Android 15: launch, disclosure, permissions, foreground location start, background notification, stop passed. Coordinates simulated in emulator.\n')
